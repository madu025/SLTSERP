import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import crypto from 'crypto';
import { TransactionClient, UUID } from '@/types/inventory/inventory-service.types';

export interface CreateLedgerEntryInput {
    storeId: string;
    itemId: string;
    batchId?: string | null;
    transactionType: 'GRN_RECEIPT' | 'CONTRACTOR_ISSUE' | 'CONTRACTOR_RETURN' | 'MRN_APPROVAL' | 'SOD_INSTALLATION' | 'WASTAGE_ADJUSTMENT' | 'CYCLE_COUNT_CORRECTION' | 'PROJECT_ISSUE' | 'PROJECT_RETURN' | 'VIRTUAL_SWAP' | 'STOCK_ISSUE' | 'STORE_TRANSFER_OUT' | 'STORE_TRANSFER_IN' | 'EMERGENCY_LOCAL_PURCHASE';
    referenceType: 'GRN' | 'ContractorMaterialIssue' | 'SOD' | 'MRN' | 'CycleCount' | 'Adjustment' | 'StockIssue' | 'ProjectIR' | 'VirtualSwap' | 'ContractorWastage' | 'StockRequest';
    referenceId: string;
    quantityBefore: number | Decimal;
    quantityChange: number | Decimal;
    quantityAfter: number | Decimal;
    unitPrice?: number | Decimal;
    performedById: string;
    idempotencyKey?: string;
}

type Decimal = Prisma.Decimal;

export class AuditLedgerService {
    /** Only real user UUIDs may be stored; 'SYSTEM'/'STOREKEEPER' actors map to null */
    private static readonly UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    /**
     * Compute SHA-256 Checksum for tamper prevention using Hash Chaining
     */
    private static generateChecksum(
        storeId: UUID,
        itemId: UUID,
        quantityAfter: string | number,
        createdAt: string,
        previousChecksum: string = 'GENESIS'
    ): string {
        const payload = `${storeId}:${itemId}:${quantityAfter}:${createdAt}:${previousChecksum}`;
        return crypto.createHash('sha256').update(payload).digest('hex');
    }

    /**
     * Atomically reserve the next document number for a given type using the
     * DB function fn_next_document_number(): `${type}-YYYY-MM-XXXX`.
     * Safe under concurrency (single-row atomic increment in PostgreSQL).
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    static async getNextDocumentNumber(type: string, tx?: TransactionClient): Promise<string> {
        const client = tx || prisma;
        const result = await client.$queryRaw<[{ number: string }]>`
            SELECT fn_next_document_number(${type}) as number
        `;
        return result[0].number;
    }

    /**
     * Generate Atomic MIN (Material Issue Note) Number: MIN-YYYY-MM-XXXX
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    static async generateMINNumber(tx?: TransactionClient): Promise<string> {
        return this.getNextDocumentNumber('MIN', tx);
    }

    /**
     * Generate Atomic MRN (Material Return Note) Number: MRN-YYYY-MM-XXXX
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    static async generateMRNNumber(tx?: TransactionClient): Promise<string> {
        return this.getNextDocumentNumber('MRN', tx);
    }

    /**
     * Record an immutable transaction entry in the Inventory Ledger (supports $transaction)
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    static async recordEntry(input: CreateLedgerEntryInput, tx?: TransactionClient) {
        const client = tx || prisma;
        
        // 1. Idempotency Check
        if (input.idempotencyKey) {
            const existing = await client.inventoryLedger.findUnique({
                where: { idempotencyKey: input.idempotencyKey }
            });
            if (existing) return existing;
        }

        // 2. Fetch Previous Checksum for Hash Chaining
        const lastEntry = await client.inventoryLedger.findFirst({
            where: { storeId: input.storeId, itemId: input.itemId },
            orderBy: { createdAt: 'desc' },
            select: { checksum: true }
        });
        const previousChecksum = lastEntry?.checksum || 'GENESIS';

        const qtyBefore = new Prisma.Decimal(String(input.quantityBefore));
        const qtyChange = new Prisma.Decimal(String(input.quantityChange));
        const qtyAfter = new Prisma.Decimal(String(input.quantityAfter));
        const price = new Prisma.Decimal(String(input.unitPrice || 0));
        const totalVal = qtyChange.abs().mul(price);
        const now = new Date();
        const nowIso = now.toISOString();

        const checksum = this.generateChecksum(
            input.storeId,
            input.itemId,
            qtyAfter.toString(),
            nowIso,
            previousChecksum
        );

        return client.inventoryLedger.create({
            data: {
                storeId: input.storeId,
                itemId: input.itemId,
                batchId: input.batchId || null,
                transactionType: input.transactionType,
                referenceType: input.referenceType,
                referenceId: input.referenceId,
                quantityBefore: qtyBefore,
                quantityChange: qtyChange,
                quantityAfter: qtyAfter,
                unitPrice: price,
                totalValue: totalVal,
                performedById: this.UUID_RE.test(input.performedById) ? input.performedById : null,
                idempotencyKey: input.idempotencyKey || null,
                previousChecksum: previousChecksum,
                checksum: checksum,
                createdAt: now
            }
        });
    }

    /**
     * Audit & Verify ledger entry checksum integrity (hash-chain aware)
     * Now powered by DB function fn_verify_ledger_integrity() using pgcrypto digest().
     * Runs entirely in PostgreSQL - no data egress, no JS-side computation.
     */
    static async verifyLedgerIntegrity(storeId?: string, itemId?: string) {
        const result = await prisma.$queryRaw<{
            total_checked: number;
            tampered_count: number;
            legacy_count: number;
            is_integral: boolean;
        }[]>`
            SELECT * FROM fn_verify_ledger_integrity(
                ${storeId || null}::uuid,
                ${itemId || null}::uuid
            )
        `;

        const r = result[0];
        return {
            totalChecked: Number(r.total_checked),
            tamperedCount: Number(r.tampered_count),
            legacyCount: Number(r.legacy_count),
            isIntegral: r.is_integral,
            auditResults: [],  // Per-entry details available via direct SQL if needed
        };
    }
}
