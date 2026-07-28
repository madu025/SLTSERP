/**
 * Phase 0 — Contractor Stock Double-Count Repair
 * ------------------------------------------------
 * Recomputes the expected `ContractorStock.quantity` for every contractor+item from
 * source-of-truth movements and reports/corrects drift introduced by the old
 * `acceptMaterialIssue` double-count bug.
 *
 * Expected quantity =
 *     Σ issued           (all ContractorMaterialIssue items, ANY status)
 *   − Σ accepted returns (ContractorMaterialReturn.status === 'ACCEPTED', acceptedQuantity ?? quantity)
 *   − Σ SOD consumption  (SODMaterialUsage where usageType !== 'WASTAGE', attributed via serviceOrder.contractorId)
 *   − Σ wastage          (ContractorWastage APPROVED items + SODMaterialUsage usageType === 'WASTAGE')
 *
 * Usage:
 *   tsx scripts/fix-contractor-stock-double-count.ts            # dry-run (default, no writes)
 *   tsx scripts/fix-contractor-stock-double-count.ts --apply    # apply decrements + ledger entries
 *
 * Corrections are DECREMENT-only (over-counted rows). Rows where actual < expected are
 * reported for manual investigation but never auto-inflated. Every correction writes an
 * idempotent CYCLE_COUNT_CORRECTION ledger entry (SHA-256 hash-chained, mirroring
 * AuditLedgerService.recordEntry) so the repair is auditable/reversible.
 */
import { PrismaClient, Prisma } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

const APPLY = process.argv.includes('--apply');
const EPSILON = 0.0001; // float tolerance

type Key = string; // `${contractorId}::${itemId}`
const key = (contractorId: string, itemId: string): Key => `${contractorId}::${itemId}`;

function addTo(map: Map<Key, number>, k: Key, qty: number) {
    map.set(k, (map.get(k) || 0) + qty);
}

/**
 * Record an idempotent, hash-chained CYCLE_COUNT_CORRECTION ledger entry inside a tx.
 * Mirrors AuditLedgerService.recordEntry so repair entries pass verifyLedgerIntegrity.
 */
async function recordCorrectionEntry(
    tx: Prisma.TransactionClient,
    params: {
        storeId: string;
        itemId: string;
        referenceId: string;
        quantityBefore: number;
        quantityChange: number;
        quantityAfter: number;
        unitPrice: number;
        idempotencyKey: string;
    }
) {
    const existing = await tx.inventoryLedger.findUnique({ where: { idempotencyKey: params.idempotencyKey } });
    if (existing) return existing;

    const lastEntry = await tx.inventoryLedger.findFirst({
        where: { storeId: params.storeId, itemId: params.itemId },
        orderBy: { createdAt: 'desc' },
        select: { checksum: true }
    });
    const previousChecksum = lastEntry?.checksum || 'GENESIS';

    const qtyBefore = new Prisma.Decimal(String(params.quantityBefore));
    const qtyChange = new Prisma.Decimal(String(params.quantityChange));
    const qtyAfter = new Prisma.Decimal(String(params.quantityAfter));
    const price = new Prisma.Decimal(String(params.unitPrice || 0));
    const totalVal = qtyChange.abs().mul(price);
    const now = new Date();

    const payload = `${params.storeId}:${params.itemId}:${qtyAfter.toString()}:${now.toISOString()}:${previousChecksum}`;
    const checksum = crypto.createHash('sha256').update(payload).digest('hex');

    return tx.inventoryLedger.create({
        data: {
            storeId: params.storeId,
            itemId: params.itemId,
            batchId: null,
            transactionType: 'CYCLE_COUNT_CORRECTION',
            referenceType: 'Adjustment',
            referenceId: params.referenceId,
            quantityBefore: qtyBefore,
            quantityChange: qtyChange,
            quantityAfter: qtyAfter,
            unitPrice: price,
            totalValue: totalVal,
            performedById: 'SYSTEM-REPAIR',
            idempotencyKey: params.idempotencyKey,
            previousChecksum,
            checksum,
            createdAt: now
        }
    });
}

async function main() {
    console.log(`\n=== Contractor Stock Double-Count Repair (${APPLY ? 'APPLY' : 'DRY-RUN'}) ===\n`);

    // 1. Actual summary stock rows
    const stocks = await prisma.contractorStock.findMany({
        include: {
            contractor: { select: { id: true, name: true, opmc: { select: { storeId: true } } } },
            item: { select: { id: true, code: true, name: true, costPrice: true } }
        }
    });

    // 2. Σ issued (any status)
    const issued = new Map<Key, number>();
    const issues = await prisma.contractorMaterialIssue.findMany({
        select: { contractorId: true, items: { select: { itemId: true, quantity: true } } }
    });
    for (const iss of issues) {
        for (const it of iss.items) addTo(issued, key(iss.contractorId, it.itemId), it.quantity);
    }

    // 3. Σ accepted returns (acceptedQuantity ?? quantity)
    const returned = new Map<Key, number>();
    const returns = await prisma.contractorMaterialReturn.findMany({
        where: { status: 'ACCEPTED' },
        select: { contractorId: true, items: { select: { itemId: true, quantity: true, acceptedQuantity: true } } }
    });
    for (const ret of returns) {
        for (const it of ret.items) {
            const qty = it.acceptedQuantity ?? it.quantity;
            addTo(returned, key(ret.contractorId, it.itemId), qty);
        }
    }

    // 4. Σ SOD usage (split WASTAGE vs consumption), attributed via serviceOrder.contractorId
    const sodConsumption = new Map<Key, number>();
    const sodWastage = new Map<Key, number>();
    const usages = await prisma.sODMaterialUsage.findMany({
        select: { itemId: true, quantity: true, usageType: true, serviceOrder: { select: { contractorId: true } } }
    });
    for (const u of usages) {
        const cId = u.serviceOrder?.contractorId;
        if (!cId) continue;
        const target = u.usageType === 'WASTAGE' ? sodWastage : sodConsumption;
        addTo(target, key(cId, u.itemId), u.quantity);
    }

    // 5. Σ contractor wastage (APPROVED)
    const contractorWastage = new Map<Key, number>();
    const wastages = await prisma.contractorWastage.findMany({
        where: { status: 'APPROVED' },
        select: { contractorId: true, items: { select: { itemId: true, quantity: true } } }
    });
    for (const w of wastages) {
        for (const it of w.items) addTo(contractorWastage, key(w.contractorId, it.itemId), it.quantity);
    }

    // 6. Σ ContractorBatchStock per contractor+item (for summary-vs-batch drift cross-check)
    const batchTotals = new Map<Key, number>();
    const batchStocks = await prisma.contractorBatchStock.findMany({
        select: { contractorId: true, itemId: true, quantity: true }
    });
    for (const b of batchStocks) addTo(batchTotals, key(b.contractorId, b.itemId), b.quantity);

    // Fallback store for ledger entries when a contractor has no mapped store
    const fallbackStore = (await prisma.inventoryStore.findFirst({ where: { type: 'MAIN' } }))
        || (await prisma.inventoryStore.findFirst());
    const fallbackStoreId = fallbackStore?.id;

    // 7. Compare & report
    let overCount = 0;   // actual > expected (double-count candidates → correctable)
    let underCount = 0;  // actual < expected (report only)
    let batchDrift = 0;
    let corrected = 0;
    let corrections = 0;

    console.log('Drift report (contractor | item | actual → expected | delta):\n');

    for (const s of stocks) {
        const k = key(s.contractorId, s.itemId);
        const expected =
            (issued.get(k) || 0)
            - (returned.get(k) || 0)
            - (sodConsumption.get(k) || 0)
            - (sodWastage.get(k) || 0)
            - (contractorWastage.get(k) || 0);
        const actual = s.quantity;
        const delta = actual - expected;

        // Batch cross-check
        const batchSum = batchTotals.get(k);
        if (batchSum !== undefined && Math.abs(batchSum - actual) > EPSILON) {
            batchDrift++;
            console.log(`  [BATCH-DRIFT] ${s.contractor.name} | ${s.item.code} ${s.item.name} | summary=${actual} vs Σbatch=${batchSum}`);
        }

        if (Math.abs(delta) <= EPSILON) continue;

        if (delta > 0) {
            overCount++;
            console.log(`  [OVER ] ${s.contractor.name} | ${s.item.code} ${s.item.name} | ${actual} → ${expected} | -${delta.toFixed(4)}`);

            if (APPLY) {
                const storeId = s.contractor.opmc?.storeId || fallbackStoreId;
                if (!storeId) {
                    console.warn(`    ! Skipped (no store for ledger): ${s.contractor.name} / ${s.item.code}`);
                    continue;
                }
                await prisma.$transaction(async (tx) => {
                    await tx.contractorStock.updateMany({
                        where: { contractorId: s.contractorId, itemId: s.itemId },
                        data: { quantity: { decrement: delta } }
                    });
                    await recordCorrectionEntry(tx, {
                        storeId,
                        itemId: s.itemId,
                        referenceId: `REPAIR-DBLCOUNT-${s.contractorId}`,
                        quantityBefore: actual,
                        quantityChange: -delta,
                        quantityAfter: expected,
                        unitPrice: s.item.costPrice ? Number(s.item.costPrice) : 0,
                        idempotencyKey: `repair-double-count-${s.contractorId}-${s.itemId}`
                    });
                });
                corrected += delta;
                corrections++;
            }
        } else {
            underCount++;
            console.log(`  [UNDER] ${s.contractor.name} | ${s.item.code} ${s.item.name} | ${actual} → ${expected} | +${(-delta).toFixed(4)} (manual review — NOT auto-corrected)`);
        }
    }

    console.log(`\n=== Summary ===`);
    console.log(`  Stock rows scanned      : ${stocks.length}`);
    console.log(`  Over-counted (fixable)  : ${overCount}`);
    console.log(`  Under-counted (review)  : ${underCount}`);
    console.log(`  Summary vs batch drift  : ${batchDrift}`);
    if (APPLY) {
        console.log(`  Corrections applied     : ${corrections} (total qty removed: ${corrected.toFixed(4)})`);
    } else {
        console.log(`  Mode                    : DRY-RUN (re-run with --apply to correct over-counted rows)`);
    }
    console.log('');
}

main()
    .catch((e) => {
        console.error('Repair failed:', e);
        process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
