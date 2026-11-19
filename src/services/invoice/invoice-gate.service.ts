import { prisma } from '@/lib/prisma';
import { AppError } from '@/lib/error';
import { resolveOpmcScope } from '@/lib/opmc-scope';
import { invoiceAreaOf } from '@/lib/invoice-access';
import { deriveEffectivePermissions } from '@/lib/effective-permissions';
import { mayActOnLevel, roleLabel, type GateActor } from '@/lib/gate-eligibility';
import { ProcessGateEngine } from '@/services/approval/process-gate-engine';
import { LedgerService } from '@/services/finance/ledger.service';
import { InvoiceCalculatorService } from '@/services/invoice/invoice.calculator.service';
import {
    INVOICE_GATE, STAGE_DONE, STAGE_RESTART, STAGE_STARTING, figuresAfterRemoval, planApproval, stageLabel,
    type ApprovalHistoryEntry,
} from '@/lib/approval-chain-rules';

const MAX_BATCH = 200;
const RESTART_PREFIX = 'RESTARTED:';

type Level = { level: number; requiredRole: string; requiredPermission: string | null; eligibleRoles: unknown; specificUserId: string | null; assignee: string; skipIfNoApprover: boolean };
type HistoryRow = ApprovalHistoryEntry & { note: string | null; createdAt: Date; userName: string | null };

async function loadPolicy() {
    return prisma.processGatePolicy.findFirst({
        where: { entityType: INVOICE_GATE.entityType, fromStatus: INVOICE_GATE.fromStatus, toStatus: INVOICE_GATE.toStatus },
        include: { approvalLevels: { where: { policyVariant: 'DEFAULT' }, orderBy: { level: 'asc' } } },
    });
}

async function loadActor(userId: string) {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
            id: true, status: true, contractorId: true, permissions: true, accessibleOpmcs: { select: { id: true } },
            systemRole: { select: { code: true, isActive: true, permissions: true, rolePermissions: { select: { permission: true, permissionDefinition: { select: { code: true } } } } } },
            sectionAssignments: { select: { role: { select: { code: true, isActive: true, permissions: true, rolePermissions: { select: { permission: true, permissionDefinition: { select: { code: true } } } } } } } },
        },
    });
    if (!user || user.status !== 'active') throw AppError.unauthorized('Authenticated approval actor is not active.');
    const permissions = deriveEffectivePermissions(user);
    const actor: GateActor = { ...user, accessibleOpmcIds: user.accessibleOpmcs.map((o) => o.id) };
    return { actor, permissions };
}

/** The steps this person could hold (the area / contractor of each invoice is checked per invoice). */
function holdsStep(actor: GateActor, permissions: readonly string[], level: Level): boolean {
    if (!level.requiredPermission || !permissions.includes(level.requiredPermission)) return false;
    if (level.assignee === 'ORDER_CONTRACTOR') return !!actor.contractorId;
    return mayActOnLevel(actor, permissions, level);
}

/** Every approval, return and restart of the given invoices, oldest first. */
async function historyFor(invoiceIds: string[], policyId: string): Promise<Map<string, HistoryRow[]>> {
    const out = new Map<string, HistoryRow[]>();
    if (invoiceIds.length === 0) return out;
    const instances = await prisma.universalApprovalInstance.findMany({
        where: { entityType: INVOICE_GATE.entityType, entityId: { in: invoiceIds }, policyId, status: { in: ['APPROVED', 'REJECTED'] } },
        select: { entityId: true, requiredRole: true, status: true, comments: true, actionedAt: true, createdAt: true, actionedById: true, actionedBy: { select: { name: true } } },
    });
    for (const i of instances) {
        const restarted = i.status === 'REJECTED' && (i.comments ?? '').startsWith(RESTART_PREFIX);
        const list = out.get(i.entityId) ?? [];
        list.push({
            userId: i.actionedById ?? '', stage: i.requiredRole, note: i.status === 'APPROVED' ? null : (i.comments ?? '').replace(RESTART_PREFIX, '').trim() || null,
            action: i.status === 'APPROVED' ? 'CONFIRMED' : restarted ? 'RESTARTED' : 'RETURNED', createdAt: i.actionedAt ?? i.createdAt, userName: i.actionedBy?.name ?? null,
        });
        out.set(i.entityId, list);
    }
    for (const list of out.values()) list.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    return out;
}

export interface InvoiceApprovalOutcome { invoiceNumber: string; stage?: string; message?: string }

export class InvoiceGateService {
    /**
     * A sentence when an invoice of this contractor would get stuck because nobody holds a step in its area, otherwise null. Shown to the
     * person who generates the invoice, so the problem is known at once rather than found later in a waiting queue.
     */
    static async approvalGap(contractorId: string): Promise<string | null> {
        try {
            const policy = await loadPolicy();
            if (!policy || !policy.isEnabled) return null;
            const { ProcessGateStatsService } = await import('@/services/admin/process-gate-stats.service');
            const sim = await ProcessGateStatsService.simulate(policy.id, { contractorId });
            const stuck = sim.steps.find((x) => x.outcome === 'NOBODY');
            return stuck ? `Nobody holds the "${stuck.title}" step in ${sim.areaName ?? 'this area'}, so this invoice will wait at that step until someone is given the role.` : null;
        } catch {
            return null;
        }
    }

    /**
     * Starts (or restarts) the area approval gate for an invoice: any open step is ended and the first applicable step is opened. Safe
     * to call twice; a second caller loses the claim on the invoice and does nothing.
     */
    static async startFor(invoiceId: string, reason = 'Approval started'): Promise<{ started: boolean; stage?: string; reason?: string }> {
        const policy = await loadPolicy();
        if (!policy || !policy.isEnabled || policy.approvalLevels.length === 0) {
            // No gate configured: the invoice goes straight on (the contractor and area confirmations are not required)
            await prisma.invoice.updateMany({ where: { id: invoiceId, confirmStage: { in: [STAGE_RESTART, STAGE_STARTING] } }, data: { confirmStage: STAGE_DONE, contractorConfirmStatus: 'CONFIRMED' } });
            return { started: false, reason: 'NO_POLICY' };
        }
        const stale = new Date(Date.now() - 5 * 60_000);
        const claimed = await prisma.invoice.updateMany({
            where: { id: invoiceId, status: { not: 'CANCELLED' }, OR: [{ confirmStage: STAGE_RESTART }, { confirmStage: STAGE_STARTING, updatedAt: { lt: stale } }] },
            data: { confirmStage: STAGE_STARTING },
        });
        if (claimed.count === 0) return { started: false, reason: 'NOT_PENDING_START' };
        try {
            await prisma.universalApprovalInstance.updateMany({
                where: { entityType: INVOICE_GATE.entityType, entityId: invoiceId, policyId: policy.id, status: 'PENDING' },
                data: { status: 'REJECTED', actionedAt: new Date(), comments: `${RESTART_PREFIX} ${reason}` },
            });
            const res = await ProcessGateEngine.startGate({ entityType: INVOICE_GATE.entityType, entityId: invoiceId, currentStatus: INVOICE_GATE.fromStatus, toStatus: INVOICE_GATE.toStatus });
            if (res.status !== 'GATE_STARTED' || !('requiredRole' in res)) throw new Error('The gate did not start');
            await prisma.invoice.update({ where: { id: invoiceId }, data: { confirmStage: res.requiredRole, contractorConfirmStatus: 'AWAITING' } });
            return { started: true, stage: res.requiredRole };
        } catch (e) {
            await prisma.invoice.updateMany({ where: { id: invoiceId, confirmStage: STAGE_STARTING }, data: { confirmStage: STAGE_RESTART } });
            console.error(`[InvoiceGate] could not start the gate for ${invoiceId}:`, e);
            return { started: false, reason: e instanceof Error ? e.message : 'FAILED' };
        }
    }

    /** Invoices marked for (re)start get their gate opened. Called before any list or action, so a missed start heals itself. */
    static async healPending(limit = 30, ids?: string[]) {
        const stale = new Date(Date.now() - 5 * 60_000);
        const rows = await prisma.invoice.findMany({
            where: { ...(ids ? { id: { in: ids } } : {}), status: { not: 'CANCELLED' }, OR: [{ confirmStage: STAGE_RESTART }, { confirmStage: STAGE_STARTING, updatedAt: { lt: stale } }] },
            select: { id: true }, take: limit,
        });
        for (const r of rows) await this.startFor(r.id, 'Invoice created');
        return rows.length;
    }

    /** Invoices waiting at a step this person holds, inside their area (or, for the contractor step, their own invoices). */
    static async queue(userId: string, filter: { stage?: string; q?: string } = {}) {
        await this.healPending(30);
        const policy = await loadPolicy();
        if (!policy || !policy.isEnabled) return { stages: [], counts: {}, invoices: [] };
        const { actor, permissions } = await loadActor(userId);
        const levels = policy.approvalLevels as Level[];
        const mine = levels.filter((l) => holdsStep(actor, permissions, l));
        if (mine.length === 0) return { stages: [], counts: {}, invoices: [] };
        const scope = await resolveOpmcScope(userId);
        const wanted = filter.stage ? mine.filter((l) => l.requiredRole === filter.stage) : mine;
        const q = filter.q?.trim();

        const instances = await prisma.universalApprovalInstance.findMany({
            where: { entityType: INVOICE_GATE.entityType, policyId: policy.id, status: 'PENDING', level: { in: mine.map((l) => l.level) } },
            select: { entityId: true, level: true }, take: 5000,
        });
        const byInvoice = new Map(instances.map((i) => [i.entityId, i.level]));
        const rows = byInvoice.size === 0 ? [] : await prisma.invoice.findMany({
            where: {
                id: { in: [...byInvoice.keys()] }, status: { not: 'CANCELLED' }, confirmStage: { notIn: [STAGE_DONE, STAGE_RESTART, STAGE_STARTING] },
                ...(q ? { OR: [{ invoiceNumber: { contains: q, mode: 'insensitive' } }, { contractor: { name: { contains: q, mode: 'insensitive' } } }] } : {}),
            },
            orderBy: [{ createdAt: 'asc' }],
            select: {
                id: true, invoiceNumber: true, totalAmount: true, amountA: true, amountB: true, month: true, year: true, rtomArea: true, confirmStage: true, contractorId: true,
                opmcId: true, contractor: { select: { name: true, opmcId: true } }, _count: { select: { sods: true, sodRemovals: true } },
            },
        });
        const visible = rows.filter((inv) => {
            const level = levels.find((l) => l.level === byInvoice.get(inv.id));
            if (!level) return false;
            if (level.assignee === 'ORDER_CONTRACTOR') return !!inv.contractorId && inv.contractorId === actor.contractorId;
            return scope === undefined || (!!invoiceAreaOf(inv) && scope.includes(invoiceAreaOf(inv) as string));
        });
        const counts: Record<string, number> = {};
        for (const inv of visible) { const role = levels.find((l) => l.level === byInvoice.get(inv.id))!.requiredRole; counts[role] = (counts[role] ?? 0) + 1; }
        const shown = visible.filter((inv) => wanted.some((l) => l.level === byInvoice.get(inv.id))).slice(0, 300);
        const history = await historyFor(shown.map((i) => i.id), policy.id);
        return {
            stages: mine.map((l) => ({ key: l.requiredRole, label: roleLabel(l.requiredRole), canRemoveSods: l.assignee !== 'ORDER_CONTRACTOR' })),
            counts,
            invoices: shown.map((inv) => ({
                id: inv.id, invoiceNumber: inv.invoiceNumber, totalAmount: inv.totalAmount, amountA: inv.amountA, amountB: inv.amountB, month: inv.month, year: inv.year, rtomArea: inv.rtomArea,
                confirmStage: inv.confirmStage, stageLabel: stageLabel(inv.confirmStage), contractor: { name: inv.contractor?.name ?? null }, sodCount: inv._count.sods, removedCount: inv._count.sodRemovals,
                approvals: (history.get(inv.id) ?? []).map((h) => ({ stage: h.stage, action: h.action, note: h.note, createdAt: h.createdAt, user: { name: h.userName } })),
            })),
        };
    }

    /** What happens to each selected invoice for one person: the open step, whether they hold it, and the history. */
    private static async judge(userId: string, ids: string[]) {
        const policy = await loadPolicy();
        if (!policy || !policy.isEnabled) throw AppError.badRequest('The invoice approval gate is not configured');
        const { actor, permissions } = await loadActor(userId);
        const levels = policy.approvalLevels as Level[];
        const scope = await resolveOpmcScope(userId);
        await this.healPending(ids.length, ids);
        const invoices = await prisma.invoice.findMany({ where: { id: { in: ids } }, select: { id: true, invoiceNumber: true, contractorId: true, confirmStage: true, opmcId: true, contractor: { select: { opmcId: true } } } });
        const open = await prisma.universalApprovalInstance.findMany({ where: { entityType: INVOICE_GATE.entityType, policyId: policy.id, status: 'PENDING', entityId: { in: ids } }, select: { id: true, entityId: true, level: true } });
        const history = await historyFor(ids, policy.id);
        return { policy, actor, permissions, levels, scope, invoices, open, history };
    }

    /**
     * Approve the step each invoice is waiting at (one or many). Every invoice is judged on its own: the answer lists the ones that
     * moved on and the ones that could not, with the reason. The last step marks the invoice area-approved (and contractor-confirmed).
     */
    static async approve(userId: string, invoiceIds: string[], note?: string) {
        const ids = [...new Set(invoiceIds)];
        if (ids.length === 0) throw AppError.badRequest('Select at least one invoice');
        if (ids.length > MAX_BATCH) throw AppError.badRequest(`Approve at most ${MAX_BATCH} invoices at a time`);
        const { actor, permissions, levels, scope, invoices, open, history } = await this.judge(userId, ids);

        const approved: InvoiceApprovalOutcome[] = [];
        const failed: InvoiceApprovalOutcome[] = [];
        for (const id of ids) if (!invoices.some((i) => i.id === id)) failed.push({ invoiceNumber: id, message: 'Invoice not found' });
        for (const inv of invoices) {
            const inst = open.find((i) => i.entityId === inv.id);
            const level = inst ? levels.find((l) => l.level === inst.level) : undefined;
            const isContractorStep = level?.assignee === 'ORDER_CONTRACTOR';
            const opmcId = invoiceAreaOf(inv);
            const plan = planApproval({
                waiting: !!inst && !!level, stageLabel: level ? roleLabel(level.requiredRole) : '-', userId,
                canAct: !!level && mayActOnLevel(actor, permissions, level, { contractorId: inv.contractorId }),
                inScope: isContractorStep || scope === undefined || (!!opmcId && scope.includes(opmcId)),
                history: history.get(inv.id) ?? [],
            });
            if (!plan.ok) { failed.push({ invoiceNumber: inv.invoiceNumber, message: plan.message }); continue; }
            try {
                const res = await ProcessGateEngine.advanceGate({ instanceId: inst!.id, action: 'APPROVED', userId, remarks: note?.trim() || undefined });
                if (isContractorStep) await prisma.invoice.update({ where: { id: inv.id }, data: { contractorConfirmedAt: new Date(), contractorConfirmedById: userId } });
                if (res.status === 'GATE_ADVANCED' && 'nextLevel' in res) {
                    const next = levels.find((l) => l.level === res.nextLevel);
                    if (next) await prisma.invoice.update({ where: { id: inv.id }, data: { confirmStage: next.requiredRole } });
                    approved.push({ invoiceNumber: inv.invoiceNumber, stage: next?.requiredRole });
                } else {
                    approved.push({ invoiceNumber: inv.invoiceNumber, stage: STAGE_DONE });
                }
            } catch (e) {
                failed.push({ invoiceNumber: inv.invoiceNumber, message: e instanceof Error ? e.message : 'Could not approve' });
            }
        }
        return { approved, failed };
    }

    /** Send invoices back to the Engineer with a reason (a person who holds the step they are waiting at may do this: the Area Manager rejecting, the contractor disputing). */
    static async returnInvoices(userId: string, invoiceIds: string[], note: string) {
        const reason = note?.trim() ?? '';
        if (reason.length < 3) throw AppError.badRequest('A reason is required to return an invoice');
        const ids = [...new Set(invoiceIds)];
        if (ids.length === 0) throw AppError.badRequest('Select at least one invoice');
        if (ids.length > MAX_BATCH) throw AppError.badRequest(`Return at most ${MAX_BATCH} invoices at a time`);
        const { actor, permissions, levels, scope, invoices, open, policy } = await this.judge(userId, ids);

        const returned: InvoiceApprovalOutcome[] = [];
        const failed: InvoiceApprovalOutcome[] = [];
        for (const id of ids) if (!invoices.some((i) => i.id === id)) failed.push({ invoiceNumber: id, message: 'Invoice not found' });
        for (const inv of invoices) {
            const inst = open.find((i) => i.entityId === inv.id);
            const level = inst ? levels.find((l) => l.level === inst.level) : undefined;
            if (!inst || !level) { failed.push({ invoiceNumber: inv.invoiceNumber, message: 'This invoice is not waiting for an approval' }); continue; }
            if (!mayActOnLevel(actor, permissions, level, { contractorId: inv.contractorId })) { failed.push({ invoiceNumber: inv.invoiceNumber, message: `Waiting for the ${roleLabel(level.requiredRole)}; you do not hold that step` }); continue; }
            const opmcId = invoiceAreaOf(inv);
            if (level.assignee !== 'ORDER_CONTRACTOR' && scope !== undefined && (!opmcId || !scope.includes(opmcId))) { failed.push({ invoiceNumber: inv.invoiceNumber, message: 'This invoice is outside your area' }); continue; }
            try {
                await ProcessGateEngine.advanceGate({ instanceId: inst.id, action: 'REJECTED', userId, remarks: reason });
                await prisma.invoice.update({ where: { id: inv.id }, data: { contractorNote: reason } });
                // the invoice is cancelled and every order goes back to the Engineer (held back, with the reason), who corrects and invoices again
                await this.takeOut(userId, inv.id, null, `Returned by the ${roleLabel(level.requiredRole)}: ${reason}`, policy.id);
                returned.push({ invoiceNumber: inv.invoiceNumber, stage: 'RETURNED_TO_ENGINEER' });
            } catch (e) {
                failed.push({ invoiceNumber: inv.invoiceNumber, message: e instanceof Error ? e.message : 'Could not return' });
            }
        }
        return { returned, failed };
    }

    /** The invoice's service orders, for the approver (or the contractor) who opened it. */
    static async sodsOf(userId: string, invoiceId: string) {
        await this.access(userId, invoiceId);
        const [sods, removed] = await Promise.all([
            prisma.serviceOrder.findMany({
                where: { invoiceId }, orderBy: { soNum: 'asc' },
                select: { id: true, soNum: true, rtom: true, customerName: true, completedDate: true, contractorAmount: true, qcStatus: true, sltsPatStatus: true, opmcPatStatus: true, hoPatStatus: true },
            }),
            prisma.invoiceSodRemoval.findMany({ where: { invoiceId }, orderBy: { createdAt: 'asc' }, select: { soNum: true, reason: true, amount: true, createdAt: true, user: { select: { name: true } } } }),
        ]);
        return { sods, removed };
    }

    /** Who may open / change an invoice that is in approval: a holder of any step in its area, or its own contractor (read only). */
    private static async access(userId: string, invoiceId: string) {
        const policy = await loadPolicy();
        if (!policy) throw AppError.badRequest('The invoice approval gate is not configured');
        const { actor, permissions } = await loadActor(userId);
        const levels = policy.approvalLevels as Level[];
        const inv = await prisma.invoice.findUnique({ where: { id: invoiceId }, select: { id: true, contractorId: true, opmcId: true, contractor: { select: { opmcId: true } } } });
        if (!inv) throw AppError.notFound('Invoice not found');
        const scope = await resolveOpmcScope(userId);
        const ownContractor = !!actor.contractorId && actor.contractorId === inv.contractorId;
        const inArea = scope === undefined || (!!invoiceAreaOf(inv) && scope.includes(invoiceAreaOf(inv) as string));
        const staffStep = levels.some((l) => l.assignee !== 'ORDER_CONTRACTOR' && mayActOnLevel(actor, permissions, l, { contractorId: inv.contractorId }));
        if (!(ownContractor || (inArea && staffStep))) throw AppError.forbidden('This invoice is outside your area');
        return { actor, permissions, levels, policy, canChange: inArea && staffStep };
    }

    /**
     * Take service orders out of an invoice that is in approval (a quality problem, or it was invoiced by mistake). The orders go back to
     * the verification list, the invoice figures and its ledger posting are redone for the orders that stay, and an invoice left with
     * no orders is cancelled. Who, when and why is kept.
     */
    static async removeSods(userId: string, invoiceId: string, sodIds: string[], reason: string) {
        const why = reason?.trim() ?? '';
        if (why.length < 3) throw AppError.badRequest('A reason is required to take service orders out of an invoice');
        const ids = [...new Set(sodIds)];
        if (ids.length === 0) throw AppError.badRequest('Select at least one service order');
        if (ids.length > MAX_BATCH) throw AppError.badRequest(`Remove at most ${MAX_BATCH} service orders at a time`);
        const { canChange, policy } = await this.access(userId, invoiceId);
        if (!canChange) throw AppError.forbidden('Only an approver of the invoice can take service orders out of it');
        return this.takeOut(userId, invoiceId, ids, why, policy.id);
    }

    /**
     * The orders leave the invoice and go back to the Engineer: they stay passed by the Area Coordinator and the QC Officer, are marked held
     * back with the reason, and the invoice total and its ledger posting are redone (an invoice left empty is cancelled). `ids` = null takes every order out.
     */
    private static async takeOut(userId: string, invoiceId: string, ids: string[] | null, why: string, policyId: string) {
        const result = await prisma.$transaction(async (tx) => {
            await tx.$executeRaw`SELECT "id" FROM "Invoice" WHERE "id" = ${invoiceId}::uuid FOR UPDATE`;
            const inv = await tx.invoice.findUnique({
                where: { id: invoiceId },
                select: {
                    id: true, invoiceNumber: true, status: true, confirmStage: true, totalAmount: true, retentionAmount: true, whtAmount: true, advanceDeduction: true,
                    sods: { select: { id: true, soNum: true, contractorAmount: true } },
                },
            });
            if (!inv) throw AppError.notFound('Invoice not found');
            if (inv.status === 'CANCELLED') throw AppError.badRequest('This invoice was cancelled');
            if (inv.confirmStage === STAGE_DONE) throw AppError.badRequest('This invoice already finished its area approval; service orders can no longer be taken out of it here');
            const wanted = ids ?? inv.sods.map((s) => s.id);
            const removing = inv.sods.filter((s) => wanted.includes(s.id));
            if (removing.length !== wanted.length) throw AppError.badRequest('One or more of the service orders are not in this invoice');
            const staying = inv.sods.filter((s) => !wanted.includes(s.id));
            const removedAmount = removing.reduce((a, s) => a + Number(s.contractorAmount ?? 0), 0);
            const newTotal = staying.reduce((a, s) => a + Number(s.contractorAmount ?? 0), 0);

            await tx.serviceOrder.updateMany({ where: { id: { in: wanted }, invoiceId }, data: { invoiced: false, invoiceId: null, isInvoicable: false, invoicingHeldAt: new Date(), invoicingHoldReason: `Taken out of invoice ${inv.invoiceNumber}: ${why}` } });
            await tx.invoiceSodRemoval.createMany({ data: removing.map((s) => ({ invoiceId, serviceOrderId: s.id, soNum: s.soNum, amount: Number(s.contractorAmount ?? 0), reason: why, userId })) });
            await tx.penalty.updateMany({ where: { invoiceId, serviceOrderId: { in: wanted }, status: { not: 'REJECTED' } }, data: { status: 'REJECTED' } });

            // The ledger posting of the invoice is cancelled and, for the orders that stay, posted again
            const posting = await tx.journalEntry.findFirst({ where: { referenceId: invoiceId, referenceType: 'INVOICE_GENERATION', status: { not: 'REVERSED' } }, orderBy: { createdAt: 'desc' }, select: { id: true } });
            if (posting) await LedgerService.reverseTransaction(tx, posting.id, `Service orders taken out of invoice ${inv.invoiceNumber}: ${why}`, userId);

            if (staying.length === 0) {
                await tx.invoice.update({ where: { id: invoiceId }, data: { status: 'CANCELLED', statusA: 'CANCELLED', statusB: 'CANCELLED', approvalStatus: 'CANCELLED', confirmStage: 'CANCELLED', totalAmount: 0, amount: 0, amountA: 0, amountB: 0, retentionAmount: 0, whtAmount: 0 } });
                await tx.universalApprovalInstance.updateMany({ where: { entityType: INVOICE_GATE.entityType, entityId: invoiceId, policyId, status: 'PENDING' }, data: { status: 'REJECTED', actionedAt: new Date(), comments: `${RESTART_PREFIX} every service order was taken out` } });
            } else {
                const figures = figuresAfterRemoval({ oldTotal: Number(inv.totalAmount), newTotal, retention: Number(inv.retentionAmount), wht: Number(inv.whtAmount), advance: Number(inv.advanceDeduction) });
                const approvedPenalties = await tx.penalty.findMany({ where: { invoiceId, status: 'APPROVED' }, select: { amount: true } });
                const penaltyTotal = approvedPenalties.reduce((a, p) => a + Number(p.amount), 0);
                const { amountA, amountB } = InvoiceCalculatorService.calculateSplit(figures.totalAmount, penaltyTotal);
                await tx.invoice.update({ where: { id: invoiceId }, data: { ...figures, amount: figures.totalAmount, amountA, amountB } });
                const revision = (await tx.journalEntry.count({ where: { referenceId: invoiceId, referenceType: 'INVOICE_GENERATION' } })) + 1;
                await LedgerService.logInvoiceGeneration(tx, invoiceId, inv.invoiceNumber, figures.totalAmount, amountA, amountB, `Revised posting for invoice ${inv.invoiceNumber} after service orders were taken out`, 0, 0, `_REV${revision}`);
            }
            await tx.auditLog.create({
                data: {
                    action: 'INVOICE_SODS_REMOVED', entity: 'Invoice', entityId: invoiceId, userId,
                    newValue: { invoiceNumber: inv.invoiceNumber, soNums: removing.map((s) => s.soNum), removedAmount, remaining: staying.length, reason: why },
                },
            });
            return { invoiceNumber: inv.invoiceNumber, removed: removing.map((s) => s.soNum), remaining: staying.length, cancelled: staying.length === 0, removedAmount };
        }, { timeout: 60_000, maxWait: 15_000 });
        return result;
    }
}
