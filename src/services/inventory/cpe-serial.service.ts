import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { AppError } from '@/lib/error';
import { resolveOpmcScope } from '@/lib/opmc-scope';
import {
    CPE_ITEMS, readCpeLines, registerDecision, checkSerialForOrder, cpeReceiptGate, enforcementFor, normalizeSerial, planOrderSerials, readCollectedRow,
    SERIAL_NOT_CLEAR, type CpeType, type CpeReceiptMode, type CpeSerialState, type CpeInputRow, type OrderSerialInput, type CpeEnforcement,
} from '@/lib/cpe-serial-rules';
import { AuditService } from '@/services/audit/audit.service';
import { AuditLedgerService } from './audit-ledger.service';
import { IssueService } from './issue.service';
import { recordCpeEvent } from './cpe-serial-events';
import type { TransactionClient } from '@/types/inventory/inventory-service.types';

type Tx = TransactionClient;
const colombo = (d = new Date()) => new Date(d.getTime() + 5.5 * 3600_000).toISOString().slice(0, 10);

export interface CpeReceiptInput {
    userId: string;
    mode: CpeReceiptMode;
    opmcId: string;
    contractorId?: string | null;
    cpeType: CpeType;
    model?: string | null;
    sltReference?: string | null;
    receivedDate: string;
    remarks?: string | null;
    rows: CpeInputRow[];
}

const serialSelect = {
    id: true, serialNumber: true, status: true, opmcId: true, cpeType: true, model: true, contractorId: true, storeId: true, sodId: true, issueCycle: true,
    sltReference: true, receivedAt: true, source: true,
    opmc: { select: { rtom: true } },
    contractor: { select: { name: true } },
    store: { select: { name: true } },
    receipt: { select: { receiptNumber: true } },
} satisfies Prisma.InventoryItemSerialSelect;
type SerialRow = Prisma.InventoryItemSerialGetPayload<{ select: typeof serialSelect }>;

async function soNums(ids: (string | null)[]): Promise<Map<string, string>> {
    const list = [...new Set(ids.filter((x): x is string => !!x))];
    if (!list.length) return new Map();
    const rows = await prisma.serviceOrder.findMany({ where: { id: { in: list } }, select: { id: true, soNum: true } });
    return new Map(rows.map((r) => [r.id, r.soNum]));
}

function toState(r: SerialRow, soNum?: string | null): CpeSerialState {
    return {
        serialNumber: r.serialNumber, status: r.status, opmcId: r.opmcId, rtom: r.opmc?.rtom ?? null, cpeType: r.cpeType, contractorId: r.contractorId,
        contractorName: r.contractor?.name ?? null, sodId: r.sodId, soNum: soNum ?? null, issueCycle: r.issueCycle,
    };
}

/**
 * CPE serials from the SLT CPE Locator, phase 1 (docs/plans/cpe-serial-locator.md): the register, receipts from SLT (to the contractor directly
 * or as a bundle to the RTOM's store), the serial history and the check a screen shows while a serial is typed or scanned. The order rules
 * are only shown in phase 1 (enforcement OFF/WARN); phase 2 enforces them when an order is completed.
 */
export class CpeSerialService {
    /** RTOMs the person works in for CPE serials: service orders or stores. undefined = every RTOM. */
    static async scope(userId: string): Promise<string[] | undefined> {
        const [sod, inv] = await Promise.all([resolveOpmcScope(userId, 'sod'), resolveOpmcScope(userId, 'inventory')]);
        if (sod === undefined || inv === undefined) return undefined;
        return [...new Set([...sod, ...inv])];
    }

    static async assertRtom(userId: string, opmcId: string | null | undefined) {
        const scope = await this.scope(userId);
        if (scope !== undefined && (!opmcId || !scope.includes(opmcId))) throw AppError.forbidden('OPMC_ACCESS_DENIED: that RTOM is not one of yours');
    }

    /** The serial item of a CPE type (created once; no SLT item codes exist). Not a material line: it never appears in the material matrix. */
    static async ensureItem(tx: Tx, cpeType: CpeType): Promise<string> {
        const def = CPE_ITEMS[cpeType];
        const found = await tx.inventoryItem.findUnique({ where: { code: def.code }, select: { id: true, hasSerial: true } });
        if (found) {
            if (!found.hasSerial) await tx.inventoryItem.update({ where: { id: found.id }, data: { hasSerial: true } });
            return found.id;
        }
        const created = await tx.inventoryItem.create({
            data: { code: def.code, name: def.name, commonName: def.name, unit: 'Nos', type: 'SLT', source: 'SLT', category: 'CPE', hasSerial: true, isOspFtth: false, isWastageAllowed: false, costPrice: 0, unitPrice: 0 } as Prisma.InventoryItemUncheckedCreateInput,
            select: { id: true },
        });
        return created.id;
    }

    /** RTOMs and contractors the screen may offer (own RTOMs only), with whether the RTOM has a store linked. */
    static async options(userId: string) {
        const scope = await this.scope(userId);
        const opmcs = await prisma.oPMC.findMany({
            where: scope === undefined ? {} : { id: { in: scope } },
            select: { id: true, rtom: true, name: true, storeId: true, store: { select: { name: true } } },
            orderBy: { rtom: 'asc' },
        });
        const contractors = await prisma.contractor.findMany({
            where: { status: 'ACTIVE', opmcId: { in: opmcs.map((o) => o.id) } },
            select: { id: true, name: true, opmcId: true, registrationNumber: true },
            orderBy: { name: 'asc' },
        });
        return {
            rtoms: opmcs.map((o) => ({ id: o.id, rtom: o.rtom, name: o.name, storeId: o.storeId, storeName: o.store?.name ?? null })),
            contractors,
        };
    }

    /** Read and judge the lines of an upload or scan list without saving anything (the preview). */
    static async preview(input: Omit<CpeReceiptInput, 'mode' | 'receivedDate'> & { mode?: string; receivedDate?: string }) {
        await this.assertRtom(input.userId, input.opmcId);
        const lines = readCpeLines(input.rows, input.cpeType);
        const existing = await this.findStates(lines.map((l) => l.serial).filter(Boolean));
        return lines.map((l) => {
            if (l.problem) return { ...l, decision: 'ERROR' as const, message: l.problem };
            const d = registerDecision(existing.get(l.serial) ?? null, input.opmcId, input.cpeType);
            return d.kind === 'REFUSED'
                ? { ...l, decision: 'ERROR' as const, message: d.message }
                : { ...l, decision: d.kind, message: d.kind === 'REISSUE' ? `Issued again by SLT (cycle ${d.nextCycle})` : 'New serial' };
        });
    }

    private static async findStates(serials: string[]): Promise<Map<string, CpeSerialState>> {
        if (!serials.length) return new Map();
        const rows = await prisma.inventoryItemSerial.findMany({ where: { serialNumber: { in: serials } }, select: serialSelect });
        const names = await soNums(rows.map((r) => r.sodId));
        return new Map(rows.map((r) => [r.serialNumber, toState(r, r.sodId ? names.get(r.sodId) : null)]));
    }

    /**
     * Record the serials SLT gave a contractor (Area Coordinator or QC Officer; a service order job, not the stores' - owner, 28 Nov 2026).
     * In one transaction: a receipt (CPR) into the RTOM's store and a MIN to the contractor, so stock, ledger and serial history all agree.
     */
    static async receive(input: CpeReceiptInput) {
        const scope = await this.scope(input.userId);
        const opmc = input.opmcId ? await prisma.oPMC.findUnique({ where: { id: input.opmcId }, select: { id: true, rtom: true, storeId: true } }) : null;
        const contractor = input.contractorId ? await prisma.contractor.findUnique({ where: { id: input.contractorId }, select: { id: true, opmcId: true, status: true, name: true } }) : null;
        const lines = readCpeLines(input.rows, input.cpeType);
        const states = await this.findStates(lines.map((l) => l.serial).filter(Boolean));
        const decisions = new Map(lines.filter((l) => !l.problem).map((l) => [l.serial, registerDecision(states.get(l.serial) ?? null, input.opmcId, input.cpeType)]));
        const refused = [...decisions.entries()].flatMap(([serial, d]) => (d.kind === 'REFUSED' ? [{ serial, message: d.message }] : []));
        const failed = cpeReceiptGate({
            mode: input.mode, opmcChosen: !!opmc, inScope: !!opmc && (scope === undefined || scope.includes(opmc.id)), storeLinked: !!opmc?.storeId,
            contractorChosen: !!contractor, contractorOfRtom: !!contractor && contractor.status === 'ACTIVE' && contractor.opmcId === input.opmcId,
            receivedDate: input.receivedDate?.slice(0, 10) || null, today: colombo(), lines, refused,
        }).find((c) => !c.ok);
        if (failed) throw AppError.badRequest(`CPE_RECEIPT_CHECK: ${failed.text}`);
        const storeId = opmc!.storeId!;
        const serials = lines.map((l) => l.serial);
        const model = input.model?.trim().slice(0, 80) || null;
        const sltReference = input.sltReference?.trim().slice(0, 120) || null;
        const receivedAt = new Date(`${input.receivedDate.slice(0, 10)}T00:00:00+05:30`);

        const result = await prisma.$transaction(async (tx) => {
            const itemId = await this.ensureItem(tx, input.cpeType);
            const receiptNumber = await AuditLedgerService.getNextDocumentNumber('CPR', tx);
            // the serials named again by SLT are locked and read inside the transaction
            const known = await tx.inventoryItemSerial.findMany({ where: { serialNumber: { in: serials } }, select: { id: true, serialNumber: true, status: true, opmcId: true, cpeType: true, issueCycle: true } });
            if (known.length) await tx.$queryRaw`SELECT "id" FROM "InventoryItemSerial" WHERE "id" = ANY(${known.map((k) => k.id)}::uuid[]) FOR UPDATE`;
            const knownBy = new Map(known.map((k) => [k.serialNumber, k]));

            const receipt = await tx.cpeReceipt.create({
                data: {
                    receiptNumber, mode: input.mode, opmcId: input.opmcId, storeId, contractorId: input.mode === 'DIRECT_TO_CONTRACTOR' ? contractor!.id : null,
                    cpeType: input.cpeType, model, sltReference, receivedDate: receivedAt, quantity: serials.length, remarks: input.remarks?.trim().slice(0, 500) || null, createdById: input.userId,
                },
            });

            // stock: one batch per receipt at cost 0 (the devices belong to SLT), into the RTOM's store, with a ledger entry
            const qty = serials.length;
            const batch = await tx.inventoryBatch.create({ data: { batchNumber: receiptNumber, itemId, initialQty: qty, costPrice: 0, unitPrice: 0 } });
            await tx.inventoryBatchStock.create({ data: { storeId, batchId: batch.id, itemId, quantity: qty } });
            const stock = await tx.inventoryStock.upsert({ where: { storeId_itemId: { storeId, itemId } }, update: { quantity: { increment: qty } }, create: { storeId, itemId, quantity: qty } });
            const after = Number(stock.quantity);
            await AuditLedgerService.recordEntry({
                storeId, itemId, batchId: batch.id, transactionType: 'CPE_RECEIPT', referenceType: 'CpeReceipt', referenceId: receipt.id,
                quantityBefore: after - qty, quantityChange: qty, quantityAfter: after, unitPrice: 0, performedById: input.userId, idempotencyKey: `CPR:${receipt.id}`,
            }, tx);

            for (const l of lines) {
                const k = knownBy.get(l.serial);
                if (!k) {
                    const row = await tx.inventoryItemSerial.create({
                        data: {
                            itemId, serialNumber: l.serial, status: 'IN_STORE', storeId, opmcId: input.opmcId, cpeType: input.cpeType, model: l.model ?? model,
                            source: 'SLT_CPE_LOCATOR', sltReference, receivedAt, issueCycle: 1, receiptId: receipt.id,
                        },
                    });
                    await recordCpeEvent(tx, { serialId: row.id, serialNumber: l.serial, eventType: 'RECEIVED', fromStatus: null, toStatus: 'IN_STORE', issueCycle: 1, opmcId: input.opmcId, storeId, documentType: 'CPR', documentNumber: receiptNumber, sltReference, performedById: input.userId });
                } else {
                    // re-checked under the lock: only a recovered / faulty / returned serial of the same RTOM may be issued again
                    const d = registerDecision({ serialNumber: k.serialNumber, status: k.status, opmcId: k.opmcId, cpeType: k.cpeType, contractorId: null, sodId: null, issueCycle: k.issueCycle }, input.opmcId, input.cpeType);
                    if (d.kind !== 'REISSUE') throw AppError.conflict(`CPE_RECEIPT_CHECK: ${d.kind === 'REFUSED' ? d.message : `Serial ${k.serialNumber} changed; reload`}`);
                    await tx.inventoryItemSerial.update({
                        where: { id: k.id },
                        data: { itemId, status: 'IN_STORE', storeId, contractorId: null, sodId: null, issueCycle: d.nextCycle, receiptId: receipt.id, sltReference, receivedAt, ...(l.model || model ? { model: l.model ?? model } : {}) },
                    });
                    await recordCpeEvent(tx, { serialId: k.id, serialNumber: k.serialNumber, eventType: 'REISSUED_BY_SLT', fromStatus: k.status, toStatus: 'IN_STORE', issueCycle: d.nextCycle, opmcId: input.opmcId, storeId, documentType: 'CPR', documentNumber: receiptNumber, sltReference, reason: 'Issued again by SLT', performedById: input.userId });
                }
            }

            let issueNumber: string | null = null;
            if (input.mode === 'DIRECT_TO_CONTRACTOR') {
                const issue = await IssueService.issueMaterial({ contractorId: contractor!.id, storeId, month: colombo().slice(0, 7), userId: input.userId, items: [{ itemId, quantity: qty, serials }] }, tx);
                issueNumber = (issue as { issueNumber: string }).issueNumber;
                await tx.cpeReceipt.update({ where: { id: receipt.id }, data: { issueNumber } });
            }
            return { id: receipt.id, receiptNumber, issueNumber, quantity: qty, mode: input.mode, rtom: opmc!.rtom };
        }, { maxWait: 10_000, timeout: 90_000 });

        AuditService.log({ userId: input.userId, action: 'RECORD_CPE_RECEIPT', entity: 'CPE_RECEIPT', entityId: result.id, newValue: { ...result, cpeType: input.cpeType, contractorId: input.contractorId ?? null } }).catch(() => undefined);
        return result;
    }

    /** The register of the person's RTOMs, newest first, with filters. */
    static async list(userId: string, f: { opmcId?: string; status?: string; cpeType?: string; contractorId?: string; q?: string; page?: number }) {
        const scope = await this.scope(userId);
        if (f.opmcId) await this.assertRtom(userId, f.opmcId);
        const where: Prisma.InventoryItemSerialWhereInput = {
            cpeType: f.cpeType ? f.cpeType : { not: null },
            ...(f.opmcId ? { opmcId: f.opmcId } : scope === undefined ? {} : { opmcId: { in: scope } }),
            ...(f.status ? { status: f.status } : {}),
            ...(f.contractorId ? { contractorId: f.contractorId } : {}),
            ...(f.q ? { serialNumber: { contains: normalizeSerial(f.q) } } : {}),
        };
        const page = Math.max(1, Math.floor(f.page ?? 1));
        const take = 100;
        const [total, rows, byStatus] = await Promise.all([
            prisma.inventoryItemSerial.count({ where }),
            prisma.inventoryItemSerial.findMany({ where, select: serialSelect, orderBy: [{ updatedAt: 'desc' }], skip: (page - 1) * take, take }),
            prisma.inventoryItemSerial.groupBy({ by: ['status'], where: { ...where, status: undefined }, _count: true }),
        ]);
        const names = await soNums(rows.map((r) => r.sodId));
        return {
            total, page, pageSize: take,
            counts: Object.fromEntries(byStatus.map((b) => [b.status, b._count])),
            rows: rows.map((r) => ({
                id: r.id, serialNumber: r.serialNumber, cpeType: r.cpeType, model: r.model, status: r.status, rtom: r.opmc?.rtom ?? null, issueCycle: r.issueCycle,
                holder: r.contractor?.name ?? r.store?.name ?? (r.sodId ? names.get(r.sodId) ?? null : null),
                soNum: r.sodId ? names.get(r.sodId) ?? null : null, receiptNumber: r.receipt?.receiptNumber ?? null, sltReference: r.sltReference, receivedAt: r.receivedAt,
            })),
        };
    }

    /** One serial and its full history. */
    static async history(userId: string, serialRaw: string) {
        const serialNumber = normalizeSerial(serialRaw);
        const row = await prisma.inventoryItemSerial.findUnique({ where: { serialNumber }, select: serialSelect });
        if (!row || !row.cpeType) throw AppError.notFound('This serial is not in the CPE register');
        await this.assertRtom(userId, row.opmcId);
        const events = await prisma.cpeSerialEvent.findMany({ where: { serialId: row.id }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] });
        const people = await prisma.user.findMany({ where: { id: { in: [...new Set(events.map((e) => e.performedById).filter((x): x is string => !!x))] } }, select: { id: true, name: true, username: true } });
        const who = new Map(people.map((p) => [p.id, p.name || p.username]));
        const contractors = await prisma.contractor.findMany({ where: { id: { in: [...new Set(events.map((e) => e.contractorId).filter((x): x is string => !!x))] } }, select: { id: true, name: true } });
        const cname = new Map(contractors.map((c) => [c.id, c.name]));
        const names = await soNums([row.sodId, ...events.map((e) => e.serviceOrderId)]);
        return {
            serial: { ...toState(row, row.sodId ? names.get(row.sodId) : null), model: row.model, sltReference: row.sltReference, receivedAt: row.receivedAt, holder: row.contractor?.name ?? row.store?.name ?? null },
            events: events.map((e) => ({
                at: e.createdAt, eventType: e.eventType, fromStatus: e.fromStatus, toStatus: e.toStatus, issueCycle: e.issueCycle, documentType: e.documentType, documentNumber: e.documentNumber,
                contractor: e.contractorId ? cname.get(e.contractorId) ?? null : null, soNum: e.serviceOrderId ? names.get(e.serviceOrderId) ?? null : null,
                sltReference: e.sltReference, reason: e.reason, by: e.performedById ? who.get(e.performedById) ?? null : null,
            })),
        };
    }

    /** Receipts of the person's RTOMs, newest first. */
    static async receipts(userId: string) {
        const scope = await this.scope(userId);
        const rows = await prisma.cpeReceipt.findMany({
            where: scope === undefined ? {} : { opmcId: { in: scope } },
            orderBy: { createdAt: 'desc' }, take: 50,
            include: { opmc: { select: { rtom: true } }, contractor: { select: { name: true } }, store: { select: { name: true } } },
        });
        const people = await prisma.user.findMany({ where: { id: { in: [...new Set(rows.map((r) => r.createdById))] } }, select: { id: true, name: true, username: true } });
        const who = new Map(people.map((p) => [p.id, p.name || p.username]));
        return rows.map((r) => ({
            id: r.id, receiptNumber: r.receiptNumber, mode: r.mode, rtom: r.opmc.rtom, store: r.store.name, contractor: r.contractor?.name ?? null, cpeType: r.cpeType, model: r.model,
            sltReference: r.sltReference, receivedDate: r.receivedDate, quantity: r.quantity, issueNumber: r.issueNumber, createdBy: who.get(r.createdById) ?? null, createdAt: r.createdAt,
        }));
    }

    /**
     * Completed orders (since the register started, 28 Nov 2026) whose ONT is not an installed SLT serial of the register: what the WARN mode
     * lets through. Shown on CPE Serials so the Area Coordinator / QC Officer can correct them before an RTOM enforces.
     */
    static async unregisteredOrders(userId: string, opmcId?: string) {
        const scope = await this.scope(userId);
        if (opmcId) await this.assertRtom(userId, opmcId);
        const orders = await prisma.serviceOrder.findMany({
            where: {
                sltsStatus: 'COMPLETED', contractorId: { not: null }, completedDate: { gte: new Date('2026-11-28T00:00:00+05:30') },
                opmcId: opmcId ? opmcId : scope === undefined ? undefined : { in: scope },
            },
            select: { id: true, soNum: true, rtom: true, voiceNumber: true, ontSerialNumber: true, ontType: true, completedDate: true, contractor: { select: { name: true } } },
            orderBy: { completedDate: 'desc' }, take: 500,
        });
        if (!orders.length) return [];
        const installed = await prisma.inventoryItemSerial.findMany({ where: { sodId: { in: orders.map((o) => o.id) }, cpeType: 'ONT' }, select: { sodId: true } });
        const ok = new Set(installed.map((i) => i.sodId));
        return orders.filter((o) => !ok.has(o.id) && o.ontType !== 'EXISTING').slice(0, 200).map((o) => ({
            soNum: o.soNum, rtom: o.rtom, voiceNumber: o.voiceNumber, ontSerialNumber: o.ontSerialNumber, completedDate: o.completedDate, contractor: o.contractor?.name ?? null,
        }));
    }

    /** The enforcement mode of an RTOM (system config CPE_SERIAL_ENFORCEMENT: one mode, or a JSON map by RTOM). */
    static async enforcement(rtom: string | null | undefined, db: Pick<TransactionClient, 'systemConfig'> = prisma): Promise<CpeEnforcement> {
        const cfg = await db.systemConfig.findUnique({ where: { key: 'CPE_SERIAL_ENFORCEMENT' }, select: { value: true } }).catch(() => null);
        return enforcementFor(cfg?.value, rtom);
    }

    /** May this serial be used on this order? Register state plus the upgrade re-use facts, read with the given client. */
    static async evaluate(db: TransactionClient, order: { id: string; soNum: string; opmcId: string | null; voiceNumber: string | null }, input: OrderSerialInput, contractorId: string | null) {
        const row = await db.inventoryItemSerial.findUnique({ where: { serialNumber: input.serial }, select: serialSelect });
        const so = row?.sodId ? await db.serviceOrder.findUnique({ where: { id: row.sodId }, select: { soNum: true, voiceNumber: true, opmcId: true } }) : null;
        const state = row && row.cpeType ? toState(row, so?.soNum ?? null) : null;
        let installedAtSameVoice = false;
        let legacyAtSameVoice = false;
        if (input.reuse && order.voiceNumber) {
            installedAtSameVoice = state?.status === 'INSTALLED' && !!so && so.voiceNumber === order.voiceNumber && so.opmcId === order.opmcId;
            if (!state) {
                const legacy = await db.serviceOrder.findFirst({
                    where: {
                        id: { not: order.id }, voiceNumber: order.voiceNumber,
                        OR: [{ ontSerialNumber: { equals: input.serial, mode: 'insensitive' } }, { iptvSerials: { some: { serialNumber: { equals: input.serial, mode: 'insensitive' } } } }],
                    },
                    select: { id: true },
                });
                legacyAtSameVoice = !!legacy;
            }
        }
        const check = checkSerialForOrder(state, {
            opmcId: order.opmcId, contractorId, soNum: order.soNum, serviceOrderId: order.id, cpeType: input.cpeType, reuse: input.reuse, installedAtSameVoice, legacyAtSameVoice,
        });
        return { state, check, rowId: row?.id ?? null, issueCycle: row?.issueCycle ?? 1, fromSod: row?.sodId ?? null, fromSoNum: so?.soNum ?? null };
    }

    /**
     * The answer a screen shows while a serial is typed or scanned on an order (Confirm Completion).
     */
    static async checkForOrder(userId: string, q: { serial: string; serviceOrderId: string; cpeType: CpeType; contractorId?: string | null; reuse?: boolean }) {
        const serialNumber = normalizeSerial(q.serial);
        const order = await prisma.serviceOrder.findUnique({ where: { id: q.serviceOrderId }, select: { id: true, soNum: true, opmcId: true, rtom: true, contractorId: true, voiceNumber: true } });
        if (!order) throw AppError.notFound('Order not found');
        const scope = await resolveOpmcScope(userId, 'sod');
        if (scope !== undefined && (!order.opmcId || !scope.includes(order.opmcId))) throw AppError.forbidden('OPMC_ACCESS_DENIED');
        const e = await this.evaluate(prisma as unknown as TransactionClient, order, { serial: serialNumber, cpeType: q.cpeType, reuse: !!q.reuse }, q.contractorId || order.contractorId);
        return { serialNumber, enforcement: await this.enforcement(order.rtom), ...e.check, holder: e.state?.contractorName ?? null, status: e.state?.status ?? null };
    }

    /**
     * Phase 2, inside the completion transaction: which serials of the order are installed (as material lines of the CPE item, so stock,
     * batches and the RETURN rollback work like any material), which are the customer's existing device kept on an upgrade, and which fail.
     * The caller refuses the completion when the RTOM enforces and something fails.
     */
    static async planForOrder(tx: TransactionClient, order: { id: string; soNum: string; opmcId: string | null; rtom: string | null; voiceNumber: string | null; iptv: string | null },
        contractorId: string | null, inputs: OrderSerialInput[]) {
        const enforcement = await this.enforcement(order.rtom, tx);
        const evaluated: Array<{ input: OrderSerialInput } & Awaited<ReturnType<typeof CpeSerialService.evaluate>>> = [];
        for (const input of inputs) evaluated.push({ input, ...(await this.evaluate(tx, order, input, contractorId)) });
        const stbCount = Math.max(0, parseInt(order.iptv ?? '0', 10) || 0);
        const strict = enforcement === 'ENFORCE';
        const plan = planOrderSerials(evaluated.map((e) => ({ input: e.input, check: e.check })), { ont: strict, stbCount: strict ? stbCount : 0 });
        const items = await tx.inventoryItem.findMany({ where: { code: { in: Object.values(CPE_ITEMS).map((i) => i.code) } }, select: { id: true, code: true } });
        const itemOf = (t: CpeType) => items.find((i) => i.code === CPE_ITEMS[t].code)?.id ?? null;
        const installLines = plan.install.flatMap((p) => {
            const itemId = itemOf(p.cpeType);
            return itemId ? [{ itemId, quantity: '1', usageType: 'USED', serialNumber: p.serial, comment: `CPE ${p.cpeType}` }] : [];
        });
        const reuse = plan.reuse.map((p) => evaluated.find((e) => e.input.serial === p.serial)!).filter((e) => !!e.rowId && !!e.fromSod && e.fromSod !== order.id);
        return { enforcement, plan, installLines, reuse, cpeItemIds: items.map((i) => i.id) };
    }

    /** Upgrade keeping the customer's device: the serial moves from the earlier order of the same voice number to this one (no stock moves). */
    static async applyReuse(tx: TransactionClient, order: { id: string; opmcId: string | null },
        reuse: Array<{ rowId: string | null; input: OrderSerialInput; issueCycle: number; fromSod: string | null; fromSoNum: string | null }>, userId: string | null) {
        for (const r of reuse) {
            if (!r.rowId) continue;
            await tx.inventoryItemSerial.update({ where: { id: r.rowId }, data: { sodId: order.id } });
            await recordCpeEvent(tx, {
                serialId: r.rowId, serialNumber: r.input.serial, eventType: 'REUSED_ON_UPGRADE', fromStatus: 'INSTALLED', toStatus: 'INSTALLED', issueCycle: r.issueCycle,
                opmcId: order.opmcId, serviceOrderId: order.id, documentType: 'SOD', documentNumber: r.fromSoNum,
                reason: `Kept by the customer on an upgrade (was on order ${r.fromSoNum ?? r.fromSod})`, performedById: userId,
            });
        }
    }

    /**
     * The old devices collected on an order (faulty, or taken back on an upgrade). Rows already on a handover form stay as they are; the
     * others are replaced by what the form sends. A readable serial that is in the register becomes RECOVERED (working) or FAULTY.
     */
    static async recordCollected(tx: TransactionClient, order: { id: string; opmcId: string | null }, contractorId: string, rows: unknown[], userId: string | null) {
        const read = (rows as Record<string, unknown>[]).map(readCollectedRow).filter((r) => r.keep);
        await tx.collectedCPE.deleteMany({ where: { serviceOrderId: order.id, handoverFormId: null, status: 'PENDING_HANDBACK' } });
        const onForm = await tx.collectedCPE.findMany({ where: { serviceOrderId: order.id, handoverFormId: { not: null } }, select: { serialNumber: true } });
        const fresh = read.filter((r) => r.serialUnreadable || !onForm.some((f) => f.serialNumber === r.serialNumber));
        if (fresh.length) {
            await tx.collectedCPE.createMany({
                data: fresh.map((r) => ({
                    serviceOrderId: order.id, contractorId, opmcId: order.opmcId, deviceType: r.deviceType, serialNumber: r.serialNumber, serialUnreadable: r.serialUnreadable,
                    condition: r.condition, model: r.model, pstnNumber: r.pstnNumber, status: 'PENDING_HANDBACK',
                })),
            });
        }
        for (const r of fresh) {
            if (r.serialUnreadable || r.serialNumber === SERIAL_NOT_CLEAR) continue;
            const row = await tx.inventoryItemSerial.findUnique({ where: { serialNumber: r.serialNumber }, select: { id: true, status: true, cpeType: true, issueCycle: true, opmcId: true } });
            if (!row?.cpeType) continue;
            const to = r.condition === 'WORKING' ? 'RECOVERED' : 'FAULTY';
            if (row.status === to || row.status === 'RETURNED_TO_SLT') continue;
            await tx.inventoryItemSerial.update({ where: { id: row.id }, data: { status: to, contractorId, storeId: null, sodId: null } });
            await recordCpeEvent(tx, {
                serialId: row.id, serialNumber: r.serialNumber, eventType: to === 'FAULTY' ? 'FAULTY' : 'RECOVERED', fromStatus: row.status, toStatus: to, issueCycle: row.issueCycle,
                opmcId: row.opmcId, contractorId, serviceOrderId: order.id, documentType: 'SOD', reason: 'Collected from the customer', performedById: userId,
            });
        }
    }
}
