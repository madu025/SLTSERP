import type { TransactionClient } from '@/types/inventory/inventory-service.types';
import { prisma } from '@/lib/prisma';
import { AppError } from '@/lib/error';
import { resolveOpmcScope } from '@/lib/opmc-scope';
import { assertAreaManagerApproves, assertSiteOfficeAccess, isCustodian, siteOfficeCode, siteOfficeScope } from '@/lib/site-office-access';
import { userHasPermission } from '@/lib/user-permissions';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { NotificationService } from '@/services/notification';
import { ACCOUNTS } from '@/services/finance/account-codes';
import { LedgerService } from '@/services/finance/ledger.service';
import {
    FLOAT_TYPES, checkIssue, checkSettlement, checkSettlementSubmission, daysOutstanding, floatAvailable, iouOutstanding, settlementPosting, settlementStatus,
} from '@/lib/osp-float-rules';
import { checkDraw, checkRefundIntoBox } from '@/lib/petty-cash-rules';

const num = (v: unknown) => Number(v ?? 0);

export interface SettlementInput { kind: string; amount?: number; reference?: string | null; settleDate?: string | Date | null; remarks?: string | null }

/**
 * The floats kept at the site offices and the settlement of the IOUs issued against them.
 * An IOU is issued (approved) against a float: it cannot take the float past its limit, and a person with an overdue unsettled IOU gets no new one.
 * The person then settles it with bills (an expense) and returns the rest (a refund); every row is kept and posts to the ledger.
 */
export class OspFloatService {
    /** A float, a box and its IOUs belong to a site office; the finance data scope decides which site offices a person sees. */
    static async assertSiteOfficeInScope(userId: string, siteOfficeId: string | null | undefined) {
        await assertSiteOfficeAccess(userId, siteOfficeId);
    }

    /** Rows made before site offices still carry an OPMC: they stay visible to the people whose OPMC scope covers it. */
    private static async visibility(userId: string) {
        const offices = await siteOfficeScope(userId);
        if (offices === undefined) return undefined;
        const opmcs = (await resolveOpmcScope(userId, 'finance')) ?? [];
        return { OR: [{ siteOfficeId: { in: offices } }, { siteOfficeId: null, opmcId: { in: opmcs } }] };
    }
    static async listFloats(userId: string) {
        const where = await this.visibility(userId);
        const floats = await prisma.ospFloat.findMany({ where: where ?? {}, orderBy: [{ siteOfficeId: 'asc' }, { type: 'asc' }] });
        const ious = floats.length ? await prisma.ospPettyCashIou.findMany({ where: { floatId: { in: floats.map((f) => f.id) }, status: 'APPROVED' }, select: { floatId: true, amount: true, settledAmount: true } }) : [];
        return floats.map((f) => {
            const outstanding = ious.filter((i) => i.floatId === f.id).reduce((a, i) => a + Math.max(0, num(i.amount) - num(i.settledAmount)), 0);
            return { ...f, limitAmount: num(f.limitAmount), outstanding: Math.round(outstanding * 100) / 100, available: floatAvailable(num(f.limitAmount), outstanding) };
        });
    }

    /** Create the float of a site office and type, or change its limit. */
    static async saveFloat(userId: string, input: { siteOfficeId: string; type: string; name: string; limitAmount: number; maxDaysOutstanding?: number; status?: string }) {
        if (!(FLOAT_TYPES as readonly string[]).includes(input.type)) throw AppError.badRequest('INVALID_FLOAT_TYPE');
        if (!(input.limitAmount >= 0)) throw AppError.badRequest('LIMIT_MUST_NOT_BE_NEGATIVE');
        const days = input.maxDaysOutstanding ?? 30;
        if (!Number.isInteger(days) || days < 0) throw AppError.badRequest('MAX_DAYS_MUST_BE_A_WHOLE_NUMBER');
        await this.assertSiteOfficeInScope(userId, input.siteOfficeId);
        const store = await prisma.inventoryStore.findUnique({ where: { id: input.siteOfficeId }, select: { type: true } });
        if (!store || !['MAIN', 'SUB'].includes(store.type)) throw AppError.badRequest('SITE_OFFICE_NOT_FOUND');
        const data = { name: input.name.trim(), limitAmount: input.limitAmount, maxDaysOutstanding: days, status: input.status ?? 'ACTIVE' };
        const saved = await prisma.ospFloat.upsert({
            where: { siteOfficeId_type: { siteOfficeId: input.siteOfficeId, type: input.type } },
            create: { siteOfficeId: input.siteOfficeId, type: input.type, createdById: userId, ...data },
            update: data,
        });
        await prisma.auditLog.create({ data: { action: 'SAVE_FLOAT', entity: 'OSP_FLOAT', entityId: saved.id, userId, newValue: { ...data }, ipAddress: 'SYSTEM', userAgent: 'SYSTEM' } });
        return saved;
    }

    /** A new IOU may name a float; it must be an active float of the same site office. */
    static async assertFloatForNewIou(floatId: string, siteOfficeId: string | null | undefined) {
        const f = await prisma.ospFloat.findUnique({ where: { id: floatId } });
        if (!f || f.status !== 'ACTIVE') throw AppError.badRequest('FLOAT_NOT_FOUND_OR_INACTIVE');
        if (siteOfficeId && f.siteOfficeId && siteOfficeId !== f.siteOfficeId) throw AppError.badRequest('FLOAT_BELONGS_TO_ANOTHER_SITE_OFFICE');
        return f;
    }

    /** Called when an IOU is approved (issued): the float's limit and the person's overdue IOUs. IOUs without a float (recorded before floats) are not checked. */
    static async assertCanIssue(tx: TransactionClient, iou: { id: string; floatId: string | null; amount: unknown; staffName: string; staffServiceNo: string | null }) {
        if (!iou.floatId) return;
        const f = await tx.ospFloat.findUnique({ where: { id: iou.floatId } });
        if (!f || f.status !== 'ACTIVE') throw AppError.badRequest('FLOAT_NOT_FOUND_OR_INACTIVE');
        await tx.$queryRaw`SELECT "id" FROM "OspFloat" WHERE "id" = ${f.id}::uuid FOR UPDATE`;
        const open = await tx.ospPettyCashIou.findMany({ where: { floatId: f.id, status: 'APPROVED', id: { not: iou.id } }, select: { amount: true, settledAmount: true, staffName: true, staffServiceNo: true, issuedDate: true } });
        const out = (i: { amount: unknown; settledAmount: unknown }) => Math.max(0, num(i.amount) - num(i.settledAmount));
        const samePerson = (i: { staffName: string; staffServiceNo: string | null }) => iou.staffServiceNo ? i.staffServiceNo === iou.staffServiceNo : i.staffName.trim().toLowerCase() === iou.staffName.trim().toLowerCase();
        const verdict = checkIssue({
            floatLimit: num(f.limitAmount),
            outstandingOthers: open.reduce((a, i) => a + out(i), 0),
            amount: num(iou.amount),
            staffOpenIous: open.filter(samePerson).map((i) => ({ outstanding: out(i), days: daysOutstanding(i.issuedDate) })),
            maxDaysOutstanding: f.maxDaysOutstanding,
        });
        if (!verdict.ok) throw AppError.badRequest(`${verdict.reason}: ${verdict.message}`);
    }

    /**
     * An IOU against a petty cash float takes its cash from the box of the same site office: the cash must be there, the box balance falls and the issue is
     * booked Dr Advances / Cr Petty cash. Returns the box id, or null when the IOU has no float, the float is not petty cash, or the office has no box
     * (those IOUs are bank funded as before).
     */
    static async drawFromBox(tx: TransactionClient, iou: { id: string; floatId: string | null; amount: unknown; staffName: string; iouNumber: string }): Promise<string | null> {
        if (!iou.floatId) return null;
        const f = await tx.ospFloat.findUnique({ where: { id: iou.floatId } });
        if (!f || f.type !== 'PETTY_CASH') return null;
        const box = f.siteOfficeId ? await tx.pettyCashAccount.findUnique({ where: { siteOfficeId: f.siteOfficeId } }) : f.opmcId ? await tx.pettyCashAccount.findFirst({ where: { opmcId: f.opmcId } }) : null;
        if (!box || box.status !== 'ACTIVE') return null;
        await tx.$queryRaw`SELECT "id" FROM "PettyCashAccount" WHERE "id" = ${box.id}::uuid FOR UPDATE`;
        const fresh = await tx.pettyCashAccount.findUniqueOrThrow({ where: { id: box.id } });
        const amount = num(iou.amount);
        const verdict = checkDraw(num(fresh.currentBalance), amount);
        if (!verdict.ok) throw AppError.badRequest(`${verdict.reason}: ${verdict.message}`);
        await tx.pettyCashAccount.update({ where: { id: box.id }, data: { currentBalance: Math.round((num(fresh.currentBalance) - amount) * 100) / 100 } });
        await LedgerService.postTransaction(tx, {
            referenceId: iou.id, referenceType: 'OSP_IOU', idempotencyKey: `OSP_IOU_ISSUE:${iou.id}`, isAutoGenerated: true,
            description: `Petty cash IOU for ${iou.staffName} (${iou.iouNumber})`, date: new Date(), opmcId: f.opmcId ?? undefined,
            lines: [
                { accountCode: ACCOUNTS.ADVANCES, debit: amount, credit: 0, description: `DR: IOU ${iou.iouNumber}` },
                { accountCode: ACCOUNTS.PETTY_CASH, debit: 0, credit: amount, description: `CR: cash drawn from the box for IOU ${iou.iouNumber}` },
            ],
        });
        return box.id;
    }

    /** The site office box an IOU draws its cash from, if any: the IOU is on a petty cash float of a site office that keeps a box. */
    private static async boxOf(iou: { floatId: string | null }): Promise<{ siteOfficeId: string; boxId: string } | null> {
        if (!iou.floatId) return null;
        const f = await prisma.ospFloat.findUnique({ where: { id: iou.floatId }, select: { type: true, siteOfficeId: true } });
        if (!f || f.type !== 'PETTY_CASH' || !f.siteOfficeId) return null;
        const box = await prisma.pettyCashAccount.findUnique({ where: { siteOfficeId: f.siteOfficeId }, select: { id: true, status: true } });
        return box && box.status === 'ACTIVE' ? { siteOfficeId: f.siteOfficeId, boxId: box.id } : null;
    }

    /** A release of cash from a site office box is approved or rejected by the Area Manager of that site office; the Finance Manager has no step in it. */
    static async assertReleaseApprover(iou: { floatId: string | null; createdById: string | null }, actorId: string | null | undefined) {
        const where = await this.boxOf(iou);
        if (!where) return;
        if (!actorId) throw AppError.unauthorized('Authentication required');
        await assertAreaManagerApproves(actorId, where.siteOfficeId, iou.createdById);
    }

    /** Best effort notices: the Area Manager hears of a request, the person who asked hears of the decision. */
    static async notifyRequest(iou: { floatId: string | null; iouNumber: string; staffName: string; amount: unknown }) {
        try {
            const where = await this.boxOf(iou);
            if (!where) return;
            const store = await prisma.inventoryStore.findUnique({ where: { id: where.siteOfficeId }, select: { areaManagerId: true, name: true } });
            if (store?.areaManagerId) await NotificationService.send({ userId: store.areaManagerId, title: 'Petty cash release waiting for your approval', message: `IOU ${iou.iouNumber} for ${iou.staffName}, Rs. ${num(iou.amount).toFixed(2)} (${store.name})`, type: 'FINANCE', priority: 'MEDIUM', link: '/petty-cash' });
        } catch { /* a missed notice never undoes the work */ }
    }
    static async notifyDecision(iou: { createdById: string | null; iouNumber: string }, approved: boolean, reason?: string) {
        try {
            if (iou.createdById) await NotificationService.send({ userId: iou.createdById, title: approved ? 'Petty cash release approved' : 'Petty cash release rejected', message: approved ? `IOU ${iou.iouNumber} was approved and the cash was taken from the box.` : `IOU ${iou.iouNumber}: ${reason ?? 'rejected'}`, type: 'FINANCE', priority: 'MEDIUM', link: '/petty-cash' });
        } catch { /* a missed notice never undoes the work */ }
    }

    /** Every IOU with what is outstanding and for how many days; settlements included. */
    static async listIous(userId: string) {
        const where = await this.visibility(userId);
        const ious = await prisma.ospPettyCashIou.findMany({ where: where ?? {}, orderBy: { createdAt: 'desc' } });
        const rows = ious.length ? await prisma.ospIouSettlement.findMany({ where: { iouId: { in: ious.map((i) => i.id) } }, orderBy: { createdAt: 'asc' } }) : [];
        return ious.map((i) => {
            const settlements = rows.filter((r) => r.iouId === i.id).map((r) => ({ ...r, amount: num(r.amount) }));
            const outstanding = i.status === 'APPROVED' ? iouOutstanding(num(i.amount), settlements) : 0;
            return { ...i, amount: num(i.amount), settledAmount: num(i.settledAmount), outstanding, daysOutstanding: i.status === 'APPROVED' && outstanding > 0 ? daysOutstanding(i.issuedDate ?? i.createdAt) : 0, settlements };
        });
    }

    /** Bills handed in, cash returned, or a follow-up reminder on an issued IOU. */
    static async recordSettlement(userId: string, iouId: string, input: SettlementInput) {
        const amount = Math.round((input.amount ?? 0) * 100) / 100;
        const date = input.settleDate ? new Date(input.settleDate) : new Date();
        if (Number.isNaN(date.getTime())) throw AppError.badRequest('SETTLE_DATE_INVALID');
        const header = await prisma.ospPettyCashIou.findUnique({ where: { id: iouId }, select: { opmcId: true, siteOfficeId: true } });
        if (!header) throw AppError.notFound('IOU_NOT_FOUND');
        if (header.siteOfficeId) await this.assertSiteOfficeInScope(userId, header.siteOfficeId);
        else {
            const legacy = await resolveOpmcScope(userId, 'finance');
            if (legacy !== undefined && (!header.opmcId || !legacy.includes(header.opmcId))) throw AppError.forbidden('OPMC_SCOPE_VIOLATION: this IOU is outside your area');
        }

        return prisma.$transaction((tx) => this.applyInTx(tx, userId, iouId, input, amount, date, {}), { maxWait: 10_000, timeout: 30_000 });
    }

    /** One entry of a settlement, inside the caller's transaction. The maker is who handed the bills in, the user is who books it. */
    private static async applyInTx(tx: TransactionClient, userId: string, iouId: string, input: SettlementInput, amount: number, date: Date, extra: { makerId?: string; receiptUrl?: string | null }) {
            // one settlement at a time per IOU: the outstanding amount is read under the lock
            await tx.$queryRaw`SELECT "id" FROM "OspPettyCashIou" WHERE "id" = ${iouId}::uuid FOR UPDATE`;
            const iou = await tx.ospPettyCashIou.findUniqueOrThrow({ where: { id: iouId } });
            const f = iou.floatId ? await tx.ospFloat.findUnique({ where: { id: iou.floatId }, select: { type: true } }) : null;
            const existing = (await tx.ospIouSettlement.findMany({ where: { iouId } })).map((r) => ({ kind: r.kind, amount: num(r.amount) }));
            const outstanding = iouOutstanding(num(iou.amount), existing);
            const verdict = checkSettlement({ kind: input.kind, amount, outstanding, iouStatus: iou.status });
            if (!verdict.ok) throw AppError.badRequest(`${verdict.reason}: ${verdict.message}`);

            const row = await tx.ospIouSettlement.create({ data: { iouId, kind: input.kind, amount, reference: input.reference?.trim() || null, settleDate: date, remarks: input.remarks?.trim() || null, recordedById: extra.makerId ?? userId } });

            if (input.kind === 'BILLS' || input.kind === 'REFUND') {
                // an IOU drawn from a petty cash box settles through the box: bills become an approved bill of the box (the cash left when the IOU was issued),
                // a refund puts the cash back
                const boxId = iou.pettyCashAccountId;
                if (boxId) {
                    await tx.$queryRaw`SELECT "id" FROM "PettyCashAccount" WHERE "id" = ${boxId}::uuid FOR UPDATE`;
                    const box = await tx.pettyCashAccount.findUniqueOrThrow({ where: { id: boxId }, include: { opmc: { select: { rtom: true } } } });
                    const code = await (async () => { if (box.siteOfficeId) { const st = await tx.inventoryStore.findUnique({ where: { id: box.siteOfficeId }, select: { name: true } }); return siteOfficeCode(st?.name ?? 'SITE'); } return box.opmc?.rtom ?? 'PC'; })();
                    if (input.kind === 'REFUND') {
                        const back = checkRefundIntoBox(num(box.imprestLimit), num(box.currentBalance), amount);
                        if (!back.ok) throw AppError.badRequest(`${back.reason}: ${back.message}`);
                        await tx.pettyCashAccount.update({ where: { id: boxId }, data: { currentBalance: Math.round((num(box.currentBalance) + amount) * 100) / 100 } });
                    } else {
                        await tx.pettyCashVoucher.create({
                            data: {
                                accountId: boxId, voucherNumber: `PCV-${code}-${date.getFullYear()}-I${row.id.replace(/-/g, '').slice(-8).toUpperCase()}`,
                                date, title: `Bills of IOU ${iou.iouNumber} (${iou.staffName})`, description: input.reference?.trim() || null, amount, category: 'IOU settlement',
                                status: 'APPROVED', recipientName: iou.staffName, iouId: iou.id, createdById: extra.makerId ?? userId, approvedAt: new Date(), receiptUrl: extra.receiptUrl ?? null,
                            },
                        });
                    }
                }
                const post = settlementPosting(input.kind, f?.type ?? iou.type, !!boxId);
                const code = { EXPENSE_PETTY: ACCOUNTS.PETTY_CASH_EXPENSE, EXPENSE_OSP: ACCOUNTS.OSP_EXPENSE, BANK: ACCOUNTS.BANK, PETTY_CASH: ACCOUNTS.PETTY_CASH, ADVANCES: ACCOUNTS.ADVANCES } as const;
                const what = input.kind === 'BILLS' ? 'Bills settled' : 'Cash returned';
                await LedgerService.postTransaction(tx, {
                    referenceId: row.id, referenceType: 'OSP_IOU_SETTLEMENT', idempotencyKey: `OSP_IOU_SETTLEMENT:${row.id}`, isAutoGenerated: true,
                    description: `${what} on IOU ${iou.iouNumber} (${iou.staffName})`, date, createdById: userId, opmcId: iou.opmcId ?? undefined,
                    lines: [
                        { accountCode: code[post.debit], debit: amount, credit: 0, description: `DR: ${what} ${iou.iouNumber}` },
                        { accountCode: code[post.credit], debit: 0, credit: amount, description: `CR: ${what} ${iou.iouNumber}` },
                    ],
                });
                const now = outstanding - amount;
                const status = settlementStatus(num(iou.amount), now);
                await tx.ospPettyCashIou.update({ where: { id: iouId }, data: { settledAmount: Math.round((num(iou.amount) - now) * 100) / 100, settlementStatus: status, settledAt: status === 'SETTLED' ? new Date() : null } });
            }
            return row;
    }

    /** What a person with the IOU still has to settle, and the settlement waiting for the Area Manager. */
    private static async openSubmission(iouId: string) {
        return prisma.ospIouSettlementSubmission.findFirst({ where: { iouId, status: 'SUBMITTED' } });
    }

    /**
     * The custodian settles an issued IOU of the box: the bills handed in and the cash returned. Nothing is booked yet; the Area Manager of the site office
     * verifies it (against the bills), and only then do the balance and the ledger change.
     */
    static async submitSettlement(userId: string, iouId: string, input: { bills?: number; refund?: number; reference?: string | null; receiptUrl?: string | null; remarks?: string | null }) {
        const iou = await prisma.ospPettyCashIou.findUnique({ where: { id: iouId } });
        if (!iou) throw AppError.notFound('IOU_NOT_FOUND');
        if (!iou.pettyCashAccountId) throw AppError.badRequest('NOT_A_BOX_IOU: this IOU did not come from a site office box; the finance people settle it');
        const box = await prisma.pettyCashAccount.findUnique({ where: { id: iou.pettyCashAccountId }, select: { id: true, siteOfficeId: true } });
        if (!box?.siteOfficeId) throw AppError.badRequest('NOT_A_BOX_IOU');
        await assertSiteOfficeAccess(userId, box.siteOfficeId);
        const custodian = await isCustodian(userId, box.id);
        if (!custodian && !(await userHasPermission(userId, RBAC_PERMISSIONS.FINANCE_WRITE))) throw AppError.forbidden('NOT_A_CUSTODIAN: you do not look after the petty cash of this site office');
        const bills = Math.round((input.bills ?? 0) * 100) / 100;
        const refund = Math.round((input.refund ?? 0) * 100) / 100;
        const settled = (await prisma.ospIouSettlement.findMany({ where: { iouId } })).map((r) => ({ kind: r.kind, amount: num(r.amount) }));
        const verdict = checkSettlementSubmission({ iouStatus: iou.status, outstanding: iouOutstanding(num(iou.amount), settled), bills, refund, hasWaiting: !!(await this.openSubmission(iouId)) });
        if (!verdict.ok) throw AppError.badRequest(`${verdict.reason}: ${verdict.message}`);
        const row = await prisma.ospIouSettlementSubmission.create({ data: { iouId, billsAmount: bills, refundAmount: refund, reference: input.reference?.trim() || null, receiptUrl: input.receiptUrl || null, remarks: input.remarks?.trim() || null, submittedById: userId } });
        try {
            const store = await prisma.inventoryStore.findUnique({ where: { id: box.siteOfficeId }, select: { areaManagerId: true, name: true } });
            if (store?.areaManagerId) await NotificationService.send({ userId: store.areaManagerId, title: 'Petty cash settlement waiting for your verification', message: `IOU ${iou.iouNumber} (${iou.staffName}): bills Rs. ${bills.toFixed(2)}, cash returned Rs. ${refund.toFixed(2)} (${store.name})`, type: 'FINANCE', priority: 'MEDIUM', link: '/petty-cash' });
        } catch { /* a missed notice never undoes the work */ }
        return row;
    }

    /** The Area Manager of the site office verifies the settlement (the bills and the cash returned are booked together), or sends it back with a reason. */
    static async decideSettlement(userId: string, submissionId: string, action: 'VERIFY' | 'REJECT', reason?: string | null) {
        const sub = await prisma.ospIouSettlementSubmission.findUnique({ where: { id: submissionId } });
        if (!sub) throw AppError.notFound('SETTLEMENT_NOT_FOUND');
        if (sub.status !== 'SUBMITTED') throw AppError.badRequest(`INVALID_STATE: this settlement is already ${sub.status.toLowerCase()}`);
        const iou = await prisma.ospPettyCashIou.findUniqueOrThrow({ where: { id: sub.iouId } });
        const box = iou.pettyCashAccountId ? await prisma.pettyCashAccount.findUnique({ where: { id: iou.pettyCashAccountId }, select: { siteOfficeId: true } }) : null;
        if (!box?.siteOfficeId) throw AppError.badRequest('NOT_A_BOX_IOU');
        // who may decide is settled before the transaction opens; the person who handed the bills in never verifies them
        await assertAreaManagerApproves(userId, box.siteOfficeId, sub.submittedById);
        if (action === 'REJECT') {
            if (!reason || reason.trim().length < 3) throw AppError.badRequest('A reason is required to send the settlement back');
            const claimed = await prisma.ospIouSettlementSubmission.updateMany({ where: { id: submissionId, status: 'SUBMITTED' }, data: { status: 'REJECTED', decidedById: userId, decidedAt: new Date(), rejectionReason: reason.trim() } });
            if (claimed.count !== 1) throw AppError.conflict('SETTLEMENT_ALREADY_DECIDED');
        } else {
            const date = new Date();
            await prisma.$transaction(async (tx) => {
                const claimed = await tx.ospIouSettlementSubmission.updateMany({ where: { id: submissionId, status: 'SUBMITTED' }, data: { status: 'VERIFIED', decidedById: userId, decidedAt: date } });
                if (claimed.count !== 1) throw AppError.conflict('SETTLEMENT_ALREADY_DECIDED');
                const maker = sub.submittedById ?? undefined;
                if (num(sub.billsAmount) > 0) await this.applyInTx(tx, userId, sub.iouId, { kind: 'BILLS', amount: num(sub.billsAmount), reference: sub.reference, remarks: sub.remarks, settleDate: date }, num(sub.billsAmount), date, { makerId: maker, receiptUrl: sub.receiptUrl });
                if (num(sub.refundAmount) > 0) await this.applyInTx(tx, userId, sub.iouId, { kind: 'REFUND', amount: num(sub.refundAmount), reference: sub.reference, remarks: sub.remarks, settleDate: date }, num(sub.refundAmount), date, { makerId: maker });
            }, { maxWait: 10_000, timeout: 60_000 });
        }
        try {
            if (sub.submittedById) await NotificationService.send({ userId: sub.submittedById, title: action === 'VERIFY' ? 'Petty cash settlement verified' : 'Petty cash settlement sent back', message: action === 'VERIFY' ? `IOU ${iou.iouNumber}: bills Rs. ${num(sub.billsAmount).toFixed(2)} and cash returned Rs. ${num(sub.refundAmount).toFixed(2)} were verified.` : `IOU ${iou.iouNumber}: ${reason?.trim()}`, type: 'FINANCE', priority: 'MEDIUM', link: '/petty-cash' });
        } catch { /* a missed notice never undoes the work */ }
        return prisma.ospIouSettlementSubmission.findUniqueOrThrow({ where: { id: submissionId } });
    }
}
