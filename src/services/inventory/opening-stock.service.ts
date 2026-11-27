import { prisma } from '@/lib/prisma';
import { AppError } from '@/lib/error';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { getUserEffectivePermissions } from '@/lib/user-permissions';
import { firstFailure } from '@/lib/purchase-flow-gates';
import { readOpeningRows, openingSubmitGate, openingApproveGate, linesTotal, type OpeningRow } from '@/lib/opening-stock-rules';
import { AuditService } from '@/services/audit/audit.service';
import { AuditLedgerService } from './audit-ledger.service';
import { StoreService } from './store.service';

const colombo = (d = new Date()) => new Date(d.getTime() + 5.5 * 3600_000).toISOString().slice(0, 10);
type Db = Pick<typeof prisma, 'inventoryStock' | 'openingStockLine'>;
const UPLOAD_URL = /^\/api\/(storage|files)\/[^/]/;

export interface SubmitOpeningInput { userId: string; storeId: string; countDate: string; countSheetUrl: string; remarks?: string | null; rows: OpeningRow[] }

/**
 * Opening stock of a store at go-live (owner, 27 Nov 2026; rules in lib/opening-stock-rules.ts). Store staff submit the physical count with
 * its cost; another person approves it. Approval creates, per line, a numbered FIFO batch at the line's cost, adds it to the store stock and
 * writes an OPENING_BALANCE entry in the hash-chained stock ledger, all in one transaction. An item is loaded once per store.
 */
export class OpeningStockService {
    /** Items of the store that already have stock, or are on another open (submitted) load. */
    static async alreadyLoaded(storeId: string, itemIds: string[], exceptLoadId?: string, tx: Db = prisma): Promise<string[]> {
        if (itemIds.length === 0) return [];
        const [stock, open] = await Promise.all([
            tx.inventoryStock.findMany({ where: { storeId, itemId: { in: itemIds }, quantity: { not: 0 } }, select: { itemId: true } }),
            tx.openingStockLine.findMany({ where: { itemId: { in: itemIds }, load: { storeId, status: 'SUBMITTED', ...(exceptLoadId ? { id: { not: exceptLoadId } } : {}) } }, select: { itemId: true } }),
        ]);
        return [...new Set([...stock.map((s) => s.itemId), ...open.map((o) => o.itemId)])];
    }

    static async submit(input: SubmitOpeningInput) {
        await StoreService.assertStoreWriteAccess(input.userId, input.storeId);
        const store = await prisma.inventoryStore.findUnique({ where: { id: input.storeId }, select: { id: true } });
        if (!store) throw AppError.notFound('Store not found');
        const codes = input.rows.map((r) => String(r.code ?? '').trim()).filter(Boolean);
        const items = await prisma.inventoryItem.findMany({ where: { code: { in: codes, mode: 'insensitive' } }, select: { id: true, code: true, name: true, unit: true } });
        const lines = readOpeningRows(input.rows, items);
        const already = await this.alreadyLoaded(input.storeId, lines.map((l) => l.itemId).filter((x): x is string => !!x));
        const url = (input.countSheetUrl ?? '').trim();
        const failed = firstFailure(openingSubmitGate({ storeChosen: true, lines, countDate: input.countDate?.slice(0, 10) || null, today: colombo(), countSheetAttached: UPLOAD_URL.test(url), alreadyLoaded: already }));
        if (failed) throw AppError.badRequest(`OPENING_STOCK_CHECK: ${failed.text}`);
        const totals = linesTotal(lines);
        const load = await prisma.$transaction(async (tx) => {
            const loadNumber = await AuditLedgerService.getNextDocumentNumber('OSL', tx);
            return tx.openingStockLoad.create({
                data: {
                    loadNumber, storeId: input.storeId, countDate: new Date(`${input.countDate.slice(0, 10)}T00:00:00+05:30`), countSheetUrl: url,
                    remarks: input.remarks?.trim() || null, totalQty: totals.qty, totalValue: totals.value, createdById: input.userId,
                    lines: { create: lines.map((l) => ({ itemId: l.itemId!, quantity: l.quantity, unitCost: l.unitCost, batchNumber: l.batchNumber, expiryDate: l.expiryDate ? new Date(`${l.expiryDate}T00:00:00+05:30`) : null })) },
                },
            });
        });
        AuditService.log({ userId: input.userId, action: 'SUBMIT_OPENING_STOCK', entity: 'OPENING_STOCK_LOAD', entityId: load.id, newValue: { loadNumber: load.loadNumber, storeId: input.storeId, lines: lines.length, ...totals } }).catch(() => undefined);
        return load;
    }

    static async approve(loadId: string, userId: string) {
        const load = await prisma.openingStockLoad.findUnique({ where: { id: loadId }, include: { lines: true } });
        if (!load) throw AppError.notFound('Opening stock load not found');
        await StoreService.assertStoreWriteAccess(userId, load.storeId);
        const isAdmin = (await getUserEffectivePermissions(userId)).includes(RBAC_PERMISSIONS.ADMIN_RBAC);
        const done = await prisma.$transaction(async (tx) => {
            // one approver at a time; the load and the store's stock rows are read inside the lock
            await tx.$queryRaw`SELECT "id" FROM "OpeningStockLoad" WHERE "id" = ${loadId}::uuid FOR UPDATE`;
            const fresh = await tx.openingStockLoad.findUniqueOrThrow({ where: { id: loadId } });
            const already = await this.alreadyLoaded(load.storeId, load.lines.map((l) => l.itemId), loadId, tx as unknown as Db);
            const failed = firstFailure(openingApproveGate({ status: fresh.status, actorId: userId, createdById: fresh.createdById, isAdmin, rejecting: false, alreadyLoaded: already }));
            if (failed) throw AppError.badRequest(`OPENING_STOCK_CHECK: ${failed.text}`);
            for (const [i, line] of load.lines.entries()) {
                const qty = Number(line.quantity);
                const cost = Number(line.unitCost);
                const batchNumber = line.batchNumber || `${load.loadNumber}-${String(i + 1).padStart(3, '0')}`;
                const batch = await tx.inventoryBatch.create({ data: { batchNumber, itemId: line.itemId, initialQty: qty, costPrice: cost, unitPrice: cost, expiryDate: line.expiryDate } });
                await tx.inventoryBatchStock.create({ data: { storeId: load.storeId, batchId: batch.id, itemId: line.itemId, quantity: qty } });
                const stock = await tx.inventoryStock.upsert({
                    where: { storeId_itemId: { storeId: load.storeId, itemId: line.itemId } },
                    update: { quantity: { increment: qty } },
                    create: { storeId: load.storeId, itemId: line.itemId, quantity: qty },
                });
                const after = Number(stock.quantity);
                await AuditLedgerService.recordEntry({
                    storeId: load.storeId, itemId: line.itemId, batchId: batch.id, transactionType: 'OPENING_BALANCE', referenceType: 'OpeningStockLoad', referenceId: load.id,
                    quantityBefore: after - qty, quantityChange: qty, quantityAfter: after, unitPrice: cost, performedById: userId, idempotencyKey: `OSL:${load.id}:${line.itemId}`,
                }, tx);
                await tx.openingStockLine.update({ where: { id: line.id }, data: { batchId: batch.id, batchNumber } });
            }
            return tx.openingStockLoad.update({ where: { id: loadId }, data: { status: 'APPROVED', approvedById: userId, approvedAt: new Date() } });
        }, { maxWait: 10_000, timeout: 60_000 });
        AuditService.log({ userId, action: 'APPROVE_OPENING_STOCK', entity: 'OPENING_STOCK_LOAD', entityId: loadId, newValue: { loadNumber: load.loadNumber, lines: load.lines.length, totalValue: Number(load.totalValue) } }).catch(() => undefined);
        return done;
    }

    static async reject(loadId: string, userId: string, reason: string) {
        const load = await prisma.openingStockLoad.findUnique({ where: { id: loadId } });
        if (!load) throw AppError.notFound('Opening stock load not found');
        await StoreService.assertStoreWriteAccess(userId, load.storeId);
        const isAdmin = (await getUserEffectivePermissions(userId)).includes(RBAC_PERMISSIONS.ADMIN_RBAC);
        const failed = firstFailure(openingApproveGate({ status: load.status, actorId: userId, createdById: load.createdById, isAdmin, rejecting: true, reason, alreadyLoaded: [] }));
        if (failed) throw AppError.badRequest(`OPENING_STOCK_CHECK: ${failed.text}`);
        const claim = await prisma.openingStockLoad.updateMany({ where: { id: loadId, status: 'SUBMITTED' }, data: { status: 'REJECTED', rejectedById: userId, rejectedAt: new Date(), rejectionReason: reason.trim() } });
        if (claim.count === 0) throw AppError.conflict('This load was just actioned by someone else; reload');
        AuditService.log({ userId, action: 'REJECT_OPENING_STOCK', entity: 'OPENING_STOCK_LOAD', entityId: loadId, newValue: { reason: reason.trim() } }).catch(() => undefined);
        return { id: loadId, status: 'REJECTED' };
    }

    /** The loads of the stores the user may work in, newest first, with their lines. */
    static async list(userId: string) {
        const stores = await StoreService.getAccessibleStores(userId);
        const loads = await prisma.openingStockLoad.findMany({
            where: { storeId: { in: stores.map((s) => s.id) } },
            orderBy: { createdAt: 'desc' },
            take: 200,
            include: { store: { select: { name: true } }, lines: { include: { item: { select: { code: true, name: true, unit: true } } }, orderBy: { item: { code: 'asc' } } } },
        });
        const ids = [...new Set(loads.flatMap((l) => [l.createdById, l.approvedById, l.rejectedById].filter((x): x is string => !!x)))];
        const people = ids.length ? await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, username: true } }) : [];
        const who = new Map(people.map((p) => [p.id, p.name || p.username]));
        return loads.map((l) => ({
            id: l.id, loadNumber: l.loadNumber, storeId: l.storeId, store: l.store.name, status: l.status, countDate: l.countDate, countSheetUrl: l.countSheetUrl, remarks: l.remarks,
            totalQty: Number(l.totalQty), totalValue: Number(l.totalValue), createdById: l.createdById, createdBy: who.get(l.createdById) ?? null, createdAt: l.createdAt,
            approvedBy: l.approvedById ? who.get(l.approvedById) ?? null : null, approvedAt: l.approvedAt, rejectedBy: l.rejectedById ? who.get(l.rejectedById) ?? null : null, rejectionReason: l.rejectionReason,
            lines: l.lines.map((x) => ({ code: x.item.code, name: x.item.name, unit: x.item.unit, quantity: Number(x.quantity), unitCost: Number(x.unitCost), batchNumber: x.batchNumber, expiryDate: x.expiryDate })),
        }));
    }
}
