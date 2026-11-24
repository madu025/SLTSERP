import type { TransactionClient } from '@/types/inventory/inventory-service.types';
import { prisma } from '@/lib/prisma';
import { AppError } from '@/lib/error';
import { resolveOpmcScope } from '@/lib/opmc-scope';
import { ACCOUNTS } from '@/services/finance/account-codes';
import { LedgerService } from '@/services/finance/ledger.service';
import {
    FLOAT_TYPES, checkIssue, checkSettlement, daysOutstanding, floatAvailable, iouOutstanding, settlementPosting, settlementStatus,
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
    /** The finance data scope: undefined = every site office. */
    static async assertOpmcInScope(userId: string, opmcId: string | null | undefined) {
        const scope = await resolveOpmcScope(userId, 'finance');
        if (scope === undefined) return;
        if (!opmcId || !scope.includes(opmcId)) throw AppError.forbidden('OPMC_SCOPE_VIOLATION: this site office is outside your area');
    }

    static async listFloats(userId: string) {
        const scope = await resolveOpmcScope(userId, 'finance');
        const floats = await prisma.ospFloat.findMany({ where: scope === undefined ? {} : { opmcId: { in: scope } }, orderBy: [{ opmcId: 'asc' }, { type: 'asc' }] });
        const ious = floats.length ? await prisma.ospPettyCashIou.findMany({ where: { floatId: { in: floats.map((f) => f.id) }, status: 'APPROVED' }, select: { floatId: true, amount: true, settledAmount: true } }) : [];
        return floats.map((f) => {
            const outstanding = ious.filter((i) => i.floatId === f.id).reduce((a, i) => a + Math.max(0, num(i.amount) - num(i.settledAmount)), 0);
            return { ...f, limitAmount: num(f.limitAmount), outstanding: Math.round(outstanding * 100) / 100, available: floatAvailable(num(f.limitAmount), outstanding) };
        });
    }

    /** Create the float of a site office and type, or change its limit. */
    static async saveFloat(userId: string, input: { opmcId: string; type: string; name: string; limitAmount: number; maxDaysOutstanding?: number; status?: string }) {
        if (!(FLOAT_TYPES as readonly string[]).includes(input.type)) throw AppError.badRequest('INVALID_FLOAT_TYPE');
        if (!(input.limitAmount >= 0)) throw AppError.badRequest('LIMIT_MUST_NOT_BE_NEGATIVE');
        const days = input.maxDaysOutstanding ?? 30;
        if (!Number.isInteger(days) || days < 0) throw AppError.badRequest('MAX_DAYS_MUST_BE_A_WHOLE_NUMBER');
        await this.assertOpmcInScope(userId, input.opmcId);
        const data = { name: input.name.trim(), limitAmount: input.limitAmount, maxDaysOutstanding: days, status: input.status ?? 'ACTIVE' };
        const saved = await prisma.ospFloat.upsert({
            where: { opmcId_type: { opmcId: input.opmcId, type: input.type } },
            create: { opmcId: input.opmcId, type: input.type, createdById: userId, ...data },
            update: data,
        });
        await prisma.auditLog.create({ data: { action: 'SAVE_FLOAT', entity: 'OSP_FLOAT', entityId: saved.id, userId, newValue: { ...data }, ipAddress: 'SYSTEM', userAgent: 'SYSTEM' } });
        return saved;
    }

    /** A new IOU may name a float; it must be an active float of the same site office. */
    static async assertFloatForNewIou(floatId: string, opmcId: string | null | undefined) {
        const f = await prisma.ospFloat.findUnique({ where: { id: floatId } });
        if (!f || f.status !== 'ACTIVE') throw AppError.badRequest('FLOAT_NOT_FOUND_OR_INACTIVE');
        if (opmcId && opmcId !== f.opmcId) throw AppError.badRequest('FLOAT_BELONGS_TO_ANOTHER_SITE_OFFICE');
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
        const box = await tx.pettyCashAccount.findUnique({ where: { opmcId: f.opmcId } });
        if (!box || box.status !== 'ACTIVE') return null;
        await tx.$queryRaw`SELECT "id" FROM "PettyCashAccount" WHERE "id" = ${box.id}::uuid FOR UPDATE`;
        const fresh = await tx.pettyCashAccount.findUniqueOrThrow({ where: { id: box.id } });
        const amount = num(iou.amount);
        const verdict = checkDraw(num(fresh.currentBalance), amount);
        if (!verdict.ok) throw AppError.badRequest(`${verdict.reason}: ${verdict.message}`);
        await tx.pettyCashAccount.update({ where: { id: box.id }, data: { currentBalance: Math.round((num(fresh.currentBalance) - amount) * 100) / 100 } });
        await LedgerService.postTransaction(tx, {
            referenceId: iou.id, referenceType: 'OSP_IOU', idempotencyKey: `OSP_IOU_ISSUE:${iou.id}`, isAutoGenerated: true,
            description: `Petty cash IOU for ${iou.staffName} (${iou.iouNumber})`, date: new Date(), opmcId: f.opmcId,
            lines: [
                { accountCode: ACCOUNTS.ADVANCES, debit: amount, credit: 0, description: `DR: IOU ${iou.iouNumber}` },
                { accountCode: ACCOUNTS.PETTY_CASH, debit: 0, credit: amount, description: `CR: cash drawn from the box for IOU ${iou.iouNumber}` },
            ],
        });
        return box.id;
    }

    /** Every IOU with what is outstanding and for how many days; settlements included. */
    static async listIous(userId: string) {
        const scope = await resolveOpmcScope(userId, 'finance');
        const ious = await prisma.ospPettyCashIou.findMany({ where: scope === undefined ? {} : { opmcId: { in: scope } }, orderBy: { createdAt: 'desc' } });
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
        const header = await prisma.ospPettyCashIou.findUnique({ where: { id: iouId }, select: { opmcId: true } });
        if (!header) throw AppError.notFound('IOU_NOT_FOUND');
        await this.assertOpmcInScope(userId, header.opmcId);

        return prisma.$transaction(async (tx) => {
            // one settlement at a time per IOU: the outstanding amount is read under the lock
            await tx.$queryRaw`SELECT "id" FROM "OspPettyCashIou" WHERE "id" = ${iouId}::uuid FOR UPDATE`;
            const iou = await tx.ospPettyCashIou.findUniqueOrThrow({ where: { id: iouId } });
            const f = iou.floatId ? await tx.ospFloat.findUnique({ where: { id: iou.floatId }, select: { type: true } }) : null;
            const existing = (await tx.ospIouSettlement.findMany({ where: { iouId } })).map((r) => ({ kind: r.kind, amount: num(r.amount) }));
            const outstanding = iouOutstanding(num(iou.amount), existing);
            const verdict = checkSettlement({ kind: input.kind, amount, outstanding, iouStatus: iou.status });
            if (!verdict.ok) throw AppError.badRequest(`${verdict.reason}: ${verdict.message}`);

            const row = await tx.ospIouSettlement.create({ data: { iouId, kind: input.kind, amount, reference: input.reference?.trim() || null, settleDate: date, remarks: input.remarks?.trim() || null, recordedById: userId } });

            if (input.kind === 'BILLS' || input.kind === 'REFUND') {
                // an IOU drawn from a petty cash box settles through the box: bills become an approved bill of the box (the cash left when the IOU was issued),
                // a refund puts the cash back
                const boxId = iou.pettyCashAccountId;
                if (boxId) {
                    await tx.$queryRaw`SELECT "id" FROM "PettyCashAccount" WHERE "id" = ${boxId}::uuid FOR UPDATE`;
                    const box = await tx.pettyCashAccount.findUniqueOrThrow({ where: { id: boxId }, include: { opmc: { select: { rtom: true } } } });
                    if (input.kind === 'REFUND') {
                        const back = checkRefundIntoBox(num(box.imprestLimit), num(box.currentBalance), amount);
                        if (!back.ok) throw AppError.badRequest(`${back.reason}: ${back.message}`);
                        await tx.pettyCashAccount.update({ where: { id: boxId }, data: { currentBalance: Math.round((num(box.currentBalance) + amount) * 100) / 100 } });
                    } else {
                        await tx.pettyCashVoucher.create({
                            data: {
                                accountId: boxId, voucherNumber: `PCV-${box.opmc.rtom}-${date.getFullYear()}-I${row.id.replace(/-/g, '').slice(-8).toUpperCase()}`,
                                date, title: `Bills of IOU ${iou.iouNumber} (${iou.staffName})`, description: input.reference?.trim() || null, amount, category: 'IOU settlement',
                                status: 'APPROVED', recipientName: iou.staffName, iouId: iou.id, createdById: userId, approvedAt: new Date(),
                            },
                        });
                    }
                }
                const post = settlementPosting(input.kind, f?.type ?? iou.type, !!boxId);
                const code = { EXPENSE_PETTY: ACCOUNTS.PETTY_CASH_EXPENSE, EXPENSE_OSP: ACCOUNTS.OSP_EXPENSE, BANK: ACCOUNTS.BANK, PETTY_CASH: ACCOUNTS.PETTY_CASH, ADVANCES: ACCOUNTS.ADVANCES } as const;
                const what = input.kind === 'BILLS' ? 'Bills settled' : 'Cash returned';
                await LedgerService.postTransaction(tx, {
                    referenceId: row.id, referenceType: 'OSP_IOU_SETTLEMENT', idempotencyKey: `OSP_IOU_SETTLEMENT:${row.id}`, isAutoGenerated: true,
                    description: `${what} on IOU ${iou.iouNumber} (${iou.staffName})`, date, createdById: userId, opmcId: iou.opmcId,
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
        });
    }
}
