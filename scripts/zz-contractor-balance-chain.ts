import { config } from 'dotenv'; config({ path: '.env.local' });
/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Contractor material balance through the SOD workflow, on ZZTEST data in the R-KX OPMC, with the REAL services.
 * Everything runs inside ONE transaction that is ROLLED BACK at the end: nothing stays in the database (no store, item,
 * contractor, SOD, MIN, MRN or ledger row), so it is safe on production. The OPMC record is never changed.
 *
 *   GRN-like receipt 1000 m drop wire + 3 ONTs into a ZZTEST store -> MIN to a ZZTEST contractor (600 m, 3 ONT with serials)
 *   -> SOD 1 completed: F1 120 m + G1 30 m used, 5 m wastage, 1 ONT (serial) -> edit SOD 1 (F1 100 m) -> SOD 2: 1 ONT, 40 m
 *   -> SOD 2 RETURNED (rollback) -> an old line without a batch (as before the fresh start) is rolled back
 *   -> return of 50 m: store of the issue note -> accept 45 of 50 -> balance screen rows and the store ledger.
 *
 *   pnpm exec tsx scripts/zz-contractor-balance-chain.ts
 */
const results: Array<[string, boolean, string]> = [];
const check = (n: string, ok: boolean, d = '') => { results.push([n, ok, d]); console.log(ok ? 'PASS' : 'FAIL', n, d); };
const num = (v: any) => Number(v ?? 0);
class Rollback extends Error {}

async function main() {
    const { prisma } = await import('../src/lib/prisma');
    const { EmailService } = await import('../src/services/notification/email.service');
    (EmailService as any).sendMail = async () => true;
    const { IssueService } = await import('../src/services/inventory/issue.service');
    const { StockService } = await import('../src/services/inventory/stock.service');
    const { SODMaterialService } = await import('../src/services/service-order/sod.material.service');
    const { AuditLedgerService } = await import('../src/services/inventory/audit-ledger.service');
    const { ContractorInventoryService } = await import('../src/services/inventory/contractor-inventory.service');
    const { ContractorBalanceService } = await import('../src/services/inventory/contractor-balance.service');
    const { ContractorRepository } = await import('../src/repositories/contractor.repository');

    const admin = (await prisma.user.findFirstOrThrow({ where: { username: { equals: 'admin', mode: 'insensitive' } }, select: { id: true } })).id;
    const opmc = await prisma.oPMC.findFirstOrThrow({ where: { rtom: 'R-KX' }, select: { id: true, storeId: true } });
    const TAG = 'ZZTEST-CB-' + Date.now().toString(36).toUpperCase();
    const inv = { pickContractorBatchesFIFO: StockService.pickContractorBatchesFIFO.bind(StockService), pickStoreBatchesFIFO: StockService.pickStoreBatchesFIFO.bind(StockService) } as any;

    try {
        await prisma.$transaction(async (tx: any) => {
            // ---------- setup (inside the transaction) ----------
            const store = await tx.inventoryStore.create({ data: { name: `${TAG} Store`, type: 'SUB', location: 'ZZTEST' } });
            const dw = await tx.inventoryItem.create({ data: { code: `${TAG}-DW`, name: `${TAG} Drop wire`, unit: 'm', costPrice: 40, unitPrice: 48 } });
            const ont = await tx.inventoryItem.create({ data: { code: `${TAG}-ONT`, name: `${TAG} ONT`, unit: 'Nos', costPrice: 9000, unitPrice: 9500, hasSerial: true } });
            const receive = async (item: any, qty: number, cost: number) => {
                const b = await tx.inventoryBatch.create({ data: { itemId: item.id, initialQty: qty, costPrice: cost, unitPrice: cost } });
                await tx.inventoryBatchStock.create({ data: { storeId: store.id, itemId: item.id, batchId: b.id, quantity: qty } });
                await tx.inventoryStock.create({ data: { storeId: store.id, itemId: item.id, quantity: qty } });
                await AuditLedgerService.recordEntry({ storeId: store.id, itemId: item.id, batchId: b.id, transactionType: 'GRN_RECEIPT', referenceType: 'GRN', referenceId: `${TAG}-GRN`, quantityBefore: 0, quantityChange: qty, quantityAfter: qty, unitPrice: cost, performedById: admin }, tx);
            };
            await receive(dw, 1000, 40);
            await receive(ont, 3, 9000);
            const serials = ['A', 'B', 'C'].map((x) => `${TAG}-ONT-${x}`);
            for (const sn of serials) await tx.inventoryItemSerial.create({ data: { itemId: ont.id, serialNumber: sn, status: 'IN_STORE', storeId: store.id } });
            const contractor = await tx.contractor.create({ data: { name: `${TAG} Contractor`, status: 'ACTIVE', opmcId: opmc.id } });
            const C = contractor.id;
            const mkSod = (n: number) => tx.serviceOrder.create({ data: { rtom: 'R-KX', soNum: `${TAG}-SOD${n}`, status: 'INSTALL_CLOSED', sltsStatus: 'INSTALL_CLOSED', opmcId: opmc.id, contractorId: C, completedDate: new Date() } });

            const held = async (itemId: string) => num((await tx.contractorStock.findUnique({ where: { contractorId_itemId: { contractorId: C, itemId } } }))?.quantity);
            const heldBatches = async (itemId: string) => (await tx.contractorBatchStock.findMany({ where: { contractorId: C, itemId } })).reduce((s: number, b: any) => s + num(b.quantity), 0);
            const storeQty = async (itemId: string) => num((await tx.inventoryStock.findUnique({ where: { storeId_itemId: { storeId: store.id, itemId } } }))?.quantity);
            const lastLedger = async (itemId: string) => num((await tx.inventoryLedger.findFirst({ where: { storeId: store.id, itemId }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] }))?.quantityAfter);
            const expect = async (label: string, dwHeld: number, ontHeld: number) => {
                const rows = await ContractorBalanceService.balance(C, {}, tx);
                const r = (id: string) => rows.find((x) => x.itemId === id);
                const okDw = (await held(dw.id)) === dwHeld && (await heldBatches(dw.id)) === dwHeld && r(dw.id)?.expectedNow === dwHeld && r(dw.id)?.variance === 0;
                const okOnt = (await held(ont.id)) === ontHeld && (await heldBatches(ont.id)) === ontHeld && (r(ont.id)?.expectedNow ?? 0) === ontHeld && (r(ont.id)?.variance ?? 0) === 0;
                check(`${label}: drop wire ${dwHeld} m, ONT ${ontHeld}`, okDw && okOnt, JSON.stringify({ dw: [await held(dw.id), await heldBatches(dw.id), r(dw.id)?.expectedNow, r(dw.id)?.variance], ont: [await held(ont.id), await heldBatches(ont.id), r(ont.id)?.expectedNow] }));
            };

            // ---------- 1. issue (MIN) ----------
            const issue = await IssueService.issueMaterial({ contractorId: C, storeId: store.id, month: new Date().toISOString().slice(0, 7), userId: admin, items: [{ itemId: dw.id, quantity: 600 }, { itemId: ont.id, quantity: 3, serials }] }, tx);
            check('MIN number on the issue note', /^MIN-/.test(issue.issueNumber), issue.issueNumber);
            await expect('after MIN', 600, 3);
            check('store after MIN: 400 m, ledger agrees', (await storeQty(dw.id)) === 400 && (await lastLedger(dw.id)) === 400, `${await storeQty(dw.id)} / ${await lastLedger(dw.id)}`);

            // ---------- 2. SOD 1 completed with material ----------
            const sod1 = await mkSod(1);
            const record = async (sod: any, lines: any[]) => {
                const res = await SODMaterialService.processMaterialUsage(tx, sod.id, opmc.id, C, lines, inv, admin);
                if (res.create.length) await tx.sODMaterialUsage.createMany({ data: res.create.map((x: any) => ({ ...x, serviceOrderId: sod.id })) });
            };
            await record(sod1, [
                { itemId: dw.id, quantity: '120', usageType: 'USED_F1' }, { itemId: dw.id, quantity: '30', usageType: 'USED_G1' },
                { itemId: dw.id, quantity: '5', usageType: 'WASTAGE', comment: 'cut end' }, { itemId: ont.id, quantity: '1', usageType: 'USED', serialNumber: serials[0] },
            ]);
            await expect('after SOD 1 (F1 120 + G1 30 + wastage 5, 1 ONT)', 445, 2);
            check('ONT serial A installed on SOD 1', (await tx.inventoryItemSerial.findUnique({ where: { serialNumber: serials[0] } }))?.status === 'INSTALLED');
            check('store unchanged by SOD use (stock with contractor)', (await storeQty(dw.id)) === 400 && (await lastLedger(dw.id)) === 400);

            // ---------- 3. edit SOD 1 (F1 100) ----------
            await record(sod1, [
                { itemId: dw.id, quantity: '100', usageType: 'USED_F1' }, { itemId: dw.id, quantity: '30', usageType: 'USED_G1' },
                { itemId: dw.id, quantity: '5', usageType: 'WASTAGE' }, { itemId: ont.id, quantity: '1', usageType: 'USED', serialNumber: serials[0] },
            ]);
            await expect('after editing SOD 1 to F1 100', 465, 2);

            // ---------- 4. more than held is refused ----------
            const sod2 = await mkSod(2);
            let refused = '';
            try { await tx.$executeRawUnsafe('SAVEPOINT over'); await record(sod2, [{ itemId: dw.id, quantity: '9999', usageType: 'USED_F1' }]); } catch (e: any) { refused = String(e.message); await tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT over'); }
            check('using more than the contractor holds is refused', /INSUFFICIENT_CONTRACTOR_STOCK/.test(refused), refused.slice(0, 90));
            await expect('after the refused use', 465, 2);

            // ---------- 5. SOD 2 used then RETURNED in the portal (rollback gives it back) ----------
            await record(sod2, [{ itemId: dw.id, quantity: '40', usageType: 'USED_F1' }, { itemId: ont.id, quantity: '1', usageType: 'USED', serialNumber: serials[1] }]);
            await expect('after SOD 2 (40 m, 1 ONT)', 425, 1);
            await SODMaterialService.rollbackMaterialUsage(tx, sod2.id, 'SYNC_SERVICE');
            await expect('after SOD 2 returned (rollback)', 465, 2);
            check('ONT serial B back with the contractor', (await tx.inventoryItemSerial.findUnique({ where: { serialNumber: serials[1] } }))?.status === 'ISSUED');

            // ---------- 6. an old line without a batch (written before the fresh start) rolled back when its order is returned ----------
            const sod3 = await mkSod(3);
            await tx.sODMaterialUsage.create({ data: { serviceOrderId: sod3.id, itemId: dw.id, quantity: 342, unit: 'm', usageType: 'PORTAL_SYNC', batchId: null } });
            await SODMaterialService.rollbackMaterialUsage(tx, sod3.id, 'SYNC_SERVICE');
            await expect('old line without a batch rolled back: no stock created', 465, 2);

            // ---------- 7. return (MRN) ----------
            const retStore = await ContractorInventoryService.resolveReturnStoreId(tx, C, dw.id);
            check('return goes to the store that issued the material', retStore === store.id, `${retStore === store.id ? 'issuing store' : retStore}`);
            const mrnNo = await AuditLedgerService.generateMRNNumber(tx);
            const ret = await tx.contractorMaterialReturn.create({ data: { returnNumber: mrnNo, contractorId: C, storeId: retStore!, month: new Date().toISOString().slice(0, 7), status: 'PENDING', items: { create: [{ itemId: dw.id, quantity: 50, unit: 'm', condition: 'GOOD' }] } }, include: { items: true } });
            // accept 45 of 50 (same steps as ContractorInventoryService.acceptMaterialReturn, which opens its own transaction)
            const picked = await StockService.pickContractorBatchesFIFO(tx, C, dw.id, 45);
            for (const p of picked) {
                await ContractorRepository.decrementBatchStockAtomic(C, p.batchId!, p.quantity, tx);
                await tx.inventoryBatchStock.update({ where: { storeId_batchId: { storeId: store.id, batchId: p.batchId } }, data: { quantity: { increment: p.quantity } } });
            }
            await ContractorRepository.decrementStockAtomic(C, dw.id, 45, tx);
            const before = await storeQty(dw.id);
            await tx.inventoryStock.update({ where: { storeId_itemId: { storeId: store.id, itemId: dw.id } }, data: { quantity: { increment: 45 } } });
            await AuditLedgerService.recordEntry({ storeId: store.id, itemId: dw.id, transactionType: 'MRN_APPROVAL', referenceType: 'MRN', referenceId: ret.id, quantityBefore: before, quantityChange: 45, quantityAfter: before + 45, performedById: admin }, tx);
            await tx.contractorMaterialReturnItem.update({ where: { id: ret.items[0].id }, data: { acceptedQuantity: 45 } });
            await tx.contractorMaterialReturn.update({ where: { id: ret.id }, data: { status: 'ACCEPTED', acceptedAt: new Date(), acceptedBy: admin } });
            check('MRN number on the return note', /^MRN-/.test(mrnNo), mrnNo);
            await expect('after MRN accepted 45 of 50', 420, 2);
            check('store after MRN: 445 m, ledger agrees', (await storeQty(dw.id)) === 445 && (await lastLedger(dw.id)) === 445);

            // ---------- 8. the screens ----------
            const rows = await ContractorBalanceService.balance(C, {}, tx);
            const r = rows.find((x) => x.itemId === dw.id)!;
            check('balance row: 600 issued - 130 used - 5 wastage - 45 returned = 420 = in hand', r.issued === 600 && r.used === 130 && r.wastage === 5 && r.returned === 45 && r.closing === 420 && r.inHand === 420 && r.variance === 0, JSON.stringify(r));
            // the office monthly sheet uses the same rule (store-scoped)
            const sheet = await ContractorBalanceService.balance(C, { storeId: store.id, period: { start: new Date(Date.now() - 86400000), end: new Date(Date.now() + 86400000) } }, tx);
            check('monthly sheet (this store, this month) closes at 420', sheet.find((x) => x.itemId === dw.id)?.closing === 420);
            // a mismatch is visible: stock moved without a document
            await tx.contractorStock.update({ where: { contractorId_itemId: { contractorId: C, itemId: dw.id } }, data: { quantity: { increment: 342 } } });
            const bad = (await ContractorBalanceService.balance(C, {}, tx)).find((x) => x.itemId === dw.id)!;
            check('stock without a document shows as a variance of +342', bad.variance === 342, `variance ${bad.variance}`);

            // ledger chain of the test store
            const chain = await tx.inventoryLedger.findMany({ where: { storeId: store.id }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] });
            const byItem = new Map<string, any[]>();
            for (const l of chain) (byItem.get(l.itemId) ?? byItem.set(l.itemId, []).get(l.itemId)!).push(l);
            let continuous = true;
            for (const ls of byItem.values()) for (let i = 1; i < ls.length; i++) if (num(ls[i].quantityBefore) !== num(ls[i - 1].quantityAfter)) continuous = false;
            check('store ledger rows chain (before = previous after) and carry checksums', continuous && chain.every((l: any) => !!l.checksum), `${chain.length} rows`);

            throw new Rollback('done');
        }, { maxWait: 15000, timeout: 180000 });
    } catch (e) {
        if (!(e instanceof Rollback)) { console.error(e); check('script ran to the end', false, String((e as any)?.message).slice(0, 200)); }
    }
    const left = await prisma.inventoryStore.count({ where: { name: { startsWith: TAG } } });
    check('rolled back: nothing left in the database', left === 0);
    const failed = results.filter((x) => !x[1]);
    console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
    await prisma.$disconnect();
    process.exit(failed.length ? 1 : 0);
}
main();
