import { prisma } from '@/lib/prisma';
import { getUserEffectivePermissions } from '@/lib/user-permissions';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { BREACH_LABEL, DAY_MS, samePerson, type BreachKind, type SodBreach, type SodBreachReport } from '@/lib/control-shared';

const MAX_ROWS = 200;

/**
 * Realised separation-of-duties breaches: the same person on both sides of a maker-checker pair, found from the
 * columns the modules already store. Report only; nothing here blocks or changes a record.
 *
 * Whether the person was an administrator is shown because administrators are exempt from most maker-checker rules.
 */
export class SodBreachService {
    static async getReport(days = 30, now = new Date()): Promise<SodBreachReport> {
        const since = new Date(now.getTime() - Math.min(365, Math.max(1, days)) * DAY_MS);
        const rows: Omit<SodBreach, 'actor' | 'adminExempt'>[] = [];
        const push = (kind: BreachKind, reference: string, actorId: string, at: Date | null, amount: number | null) =>
            rows.push({ kind, reference, actorId, at: (at ?? now).toISOString(), amount });

        // Sequential on purpose (pool safety): each query is small and indexed by date or status
        const vouchers = await prisma.paymentVoucher.findMany({ where: { approvedById: { not: null }, approvedAt: { gte: since } }, select: { pvNumber: true, createdById: true, approvedById: true, paidById: true, approvedAt: true, amount: true } });
        for (const v of vouchers) {
            if (samePerson(v.approvedById, v.paidById)) push('VOUCHER_APPROVED_AND_PAID', v.pvNumber, v.approvedById!, v.approvedAt, Number(v.amount));
            if (!v.createdById) push('VOUCHER_NO_CREATOR', v.pvNumber, v.approvedById!, v.approvedAt, Number(v.amount));
            else if (samePerson(v.createdById, v.approvedById)) push('VOUCHER_SELF_APPROVED', v.pvNumber, v.approvedById!, v.approvedAt, Number(v.amount));
        }
        const petty = await prisma.pettyCashVoucher.findMany({ where: { approvedById: { not: null }, approvedAt: { gte: since } }, select: { voucherNumber: true, createdById: true, approvedById: true, approvedAt: true, amount: true } });
        for (const v of petty) if (samePerson(v.createdById, v.approvedById)) push('PETTY_CASH_SELF_APPROVED', v.voucherNumber, v.approvedById!, v.approvedAt, Number(v.amount));

        const invoices = await prisma.projectInvoice.findMany({ where: { approvedById: { not: null }, approvedAt: { gte: since } }, select: { invoiceNumber: true, createdById: true, approvedById: true, approvedAt: true, totalAmount: true } });
        for (const i of invoices) if (samePerson(i.createdById, i.approvedById)) push('PROJECT_INVOICE_SELF_APPROVED', i.invoiceNumber, i.approvedById!, i.approvedAt, Number(i.totalAmount));

        const amendments = await prisma.invoiceAmendmentRequest.findMany({ where: { approvedById: { not: null }, approvedAt: { gte: since } }, select: { id: true, requestedById: true, approvedById: true, approvedAt: true } });
        for (const a of amendments) if (samePerson(a.requestedById, a.approvedById)) push('AMENDMENT_SELF_APPROVED', `Amendment ${a.id.slice(0, 8)}`, a.approvedById!, a.approvedAt, null);

        const requests = await prisma.stockRequest.findMany({ where: { createdAt: { gte: since } }, select: { requestNr: true, requestedById: true, approvedById: true, armApprovedById: true, storesManagerApprovedById: true, releasedById: true, createdAt: true } });
        for (const r of requests) {
            const approver = [r.approvedById, r.armApprovedById, r.storesManagerApprovedById, r.releasedById].find((x) => samePerson(x, r.requestedById));
            if (approver) push('STOCK_REQUEST_SELF_APPROVED', r.requestNr, approver, r.createdAt, null);
        }

        const mrns = await prisma.mRN.findMany({ where: { approvedById: { not: null }, createdAt: { gte: since } }, select: { mrnNumber: true, returnedById: true, approvedById: true, createdAt: true } });
        for (const m of mrns) if (samePerson(m.returnedById, m.approvedById)) push('MRN_SELF_APPROVED', m.mrnNumber, m.approvedById!, m.createdAt, null);

        const counts = await prisma.cycleCountHeader.findMany({ where: { approvedById: { not: null }, createdAt: { gte: since } }, select: { countNumber: true, countedById: true, approvedById: true, createdAt: true } });
        for (const c of counts) if (samePerson(c.countedById, c.approvedById)) push('CYCLE_COUNT_SELF_APPROVED', c.countNumber, c.approvedById!, c.createdAt, null);

        const disposals = await prisma.assetDisposalRequest.findMany({ where: { approvedById: { not: null }, createdAt: { gte: since } }, select: { id: true, requestedById: true, approvedById: true, createdAt: true } });
        for (const d of disposals) if (samePerson(d.requestedById, d.approvedById)) push('DISPOSAL_SELF_APPROVED', `Disposal ${d.id.slice(0, 8)}`, d.approvedById!, d.createdAt, null);

        // Project POs carry no creator column: the creator is the actor of the CREATE audit row
        const pos = await prisma.projectPurchaseOrder.findMany({ where: { approvedById: { not: null }, approvedAt: { gte: since } }, select: { id: true, poNumber: true, approvedById: true, approvedAt: true, totalAmount: true } });
        if (pos.length > 0) {
            const created = await prisma.auditLog.findMany({ where: { entity: 'PROJECT_PURCHASE_ORDER', action: { in: ['CREATE', 'CREATE_PROJECT_PURCHASE_ORDER'] }, entityId: { in: pos.map((p) => p.id) } }, select: { entityId: true, userId: true } });
            const creator = new Map(created.map((c) => [c.entityId, c.userId]));
            for (const p of pos) if (samePerson(creator.get(p.id), p.approvedById)) push('PO_SELF_APPROVED', p.poNumber, p.approvedById!, p.approvedAt, Number(p.totalAmount));
        }

        // Who, and were they exempt administrators?
        const actorIds = [...new Set(rows.map((r) => r.actorId))];
        const users = actorIds.length ? await prisma.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, username: true } }) : [];
        const name = new Map(users.map((u) => [u.id, u.username]));
        const exempt = new Map<string, boolean>();
        for (const id of actorIds.slice(0, 60)) {
            const perms = await getUserEffectivePermissions(id).catch(() => [] as string[]);
            exempt.set(id, perms.includes(RBAC_PERMISSIONS.ADMIN_RBAC));
        }

        const full: SodBreach[] = rows.map((r) => ({ ...r, actor: name.get(r.actorId) ?? r.actorId.slice(0, 8), adminExempt: exempt.get(r.actorId) ?? false }));
        full.sort((a, b) => b.at.localeCompare(a.at));

        const kinds = new Map<BreachKind, number>();
        const actors = new Map<string, { count: number; adminExempt: boolean }>();
        for (const r of full) {
            kinds.set(r.kind, (kinds.get(r.kind) ?? 0) + 1);
            const a = actors.get(r.actor) ?? { count: 0, adminExempt: r.adminExempt };
            a.count++;
            actors.set(r.actor, a);
        }
        return {
            asOf: now.toISOString(),
            days: Math.round((now.getTime() - since.getTime()) / DAY_MS),
            total: full.length,
            byKind: [...kinds.entries()].map(([kind, count]) => ({ kind, label: BREACH_LABEL[kind], count })).sort((a, b) => b.count - a.count),
            byActor: [...actors.entries()].map(([actor, v]) => ({ actor, ...v })).sort((a, b) => b.count - a.count).slice(0, 10),
            rows: full.slice(0, MAX_ROWS),
        };
    }
}
