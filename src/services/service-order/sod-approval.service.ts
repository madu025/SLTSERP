import { prisma } from '@/lib/prisma';
import { AppError } from '@/lib/error';
import { resolveOpmcScope } from '@/lib/opmc-scope';
import { deriveEffectivePermissions } from '@/lib/effective-permissions';
import { mayActOnLevel, roleLabel, type GateActor } from '@/lib/gate-eligibility';
import { ProcessGateEngine } from '@/services/approval/process-gate-engine';
import {
    SOD_GATE, SOD_STAGE_DONE, SOD_STAGE_RESTART, confirmationsSinceReturn, planApproval, sodStageLabel,
    type ApprovalHistoryEntry,
} from '@/lib/sod-approval-rules';

const MAX_BATCH = 200;
const STARTING = 'STARTING';
const RESTART_PREFIX = 'RESTARTED:';

type Level = { level: number; requiredRole: string; requiredPermission: string | null; eligibleRoles: unknown; specificUserId: string | null; assignee: string; skipIfNoApprover: boolean };
type HistoryRow = ApprovalHistoryEntry & { note: string | null; createdAt: Date; userName: string | null };

async function loadPolicy() {
    return prisma.processGatePolicy.findFirst({
        where: { entityType: SOD_GATE.entityType, fromStatus: SOD_GATE.fromStatus, toStatus: SOD_GATE.toStatus },
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

/** The steps this person could hold (the area / contractor of each order is checked per order). */
function holdsStep(actor: GateActor, permissions: readonly string[], level: Level): boolean {
    if (!level.requiredPermission || !permissions.includes(level.requiredPermission)) return false;
    if (level.assignee === 'ORDER_CONTRACTOR') return !!actor.contractorId;
    return mayActOnLevel(actor, permissions, level);
}

/** Every approval and return of the given orders, oldest first, from the gate and from the earlier hard-coded chain. */
async function historyFor(orderIds: string[], policyId: string): Promise<Map<string, HistoryRow[]>> {
    const out = new Map<string, HistoryRow[]>();
    if (orderIds.length === 0) return out;
    const [instances, legacy] = await Promise.all([
        prisma.universalApprovalInstance.findMany({
            where: { entityType: SOD_GATE.entityType, entityId: { in: orderIds }, policyId, status: { in: ['APPROVED', 'REJECTED'] } },
            select: { entityId: true, requiredRole: true, status: true, comments: true, actionedAt: true, createdAt: true, actionedById: true, actionedBy: { select: { name: true } } },
        }),
        prisma.sodApproval.findMany({ where: { serviceOrderId: { in: orderIds } }, select: { serviceOrderId: true, stage: true, action: true, note: true, userId: true, createdAt: true, user: { select: { name: true } } } }),
    ]);
    const push = (id: string, row: HistoryRow) => { const list = out.get(id) ?? []; list.push(row); out.set(id, list); };
    for (const l of legacy) push(l.serviceOrderId, { userId: l.userId, stage: l.stage, action: l.action, note: l.note, createdAt: l.createdAt, userName: l.user?.name ?? null });
    for (const i of instances) {
        const restarted = i.status === 'REJECTED' && (i.comments ?? '').startsWith(RESTART_PREFIX);
        push(i.entityId, {
            userId: i.actionedById ?? '', stage: i.requiredRole, note: i.status === 'APPROVED' ? null : (i.comments ?? '').replace(RESTART_PREFIX, '').trim() || null,
            action: i.status === 'APPROVED' ? 'CONFIRMED' : restarted ? 'RESTARTED' : 'RETURNED', createdAt: i.actionedAt ?? i.createdAt, userName: i.actionedBy?.name ?? null,
        });
    }
    for (const list of out.values()) list.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    return out;
}

export interface SodApprovalOutcome { soNum: string; stage?: string; message?: string }

export class SodApprovalService {
    /**
     * Starts (or restarts) the invoicing gate for a finished order: any open step is ended and the first applicable step is
     * opened. Safe to call twice; a second caller loses the claim on the order and does nothing.
     */
    static async startFor(orderId: string, reason = 'Approval started'): Promise<{ started: boolean; stage?: string; reason?: string }> {
        const policy = await loadPolicy();
        if (!policy || !policy.isEnabled || policy.approvalLevels.length === 0) {
            // No gate: the order keeps the older single "Verify Completed SODs" step
            await prisma.serviceOrder.updateMany({ where: { id: orderId, sodApprovalStage: { in: [SOD_STAGE_RESTART, STARTING] } }, data: { sodApprovalStage: null } });
            return { started: false, reason: 'NO_POLICY' };
        }
        const stale = new Date(Date.now() - 5 * 60_000);
        const claimed = await prisma.serviceOrder.updateMany({
            where: { id: orderId, invoiced: false, OR: [{ sodApprovalStage: SOD_STAGE_RESTART }, { sodApprovalStage: STARTING, updatedAt: { lt: stale } }] },
            data: { sodApprovalStage: STARTING },
        });
        if (claimed.count === 0) return { started: false, reason: 'NOT_PENDING_START' };
        try {
            await prisma.universalApprovalInstance.updateMany({
                where: { entityType: SOD_GATE.entityType, entityId: orderId, policyId: policy.id, status: 'PENDING' },
                data: { status: 'REJECTED', actionedAt: new Date(), comments: `${RESTART_PREFIX} ${reason}` },
            });
            const res = await ProcessGateEngine.startGate({ entityType: SOD_GATE.entityType, entityId: orderId, currentStatus: SOD_GATE.fromStatus, toStatus: SOD_GATE.toStatus });
            if (res.status !== 'GATE_STARTED' || !('requiredRole' in res)) throw new Error('The gate did not start');
            await prisma.serviceOrder.update({ where: { id: orderId }, data: { sodApprovalStage: res.requiredRole, isInvoicable: false } });
            return { started: true, stage: res.requiredRole };
        } catch (e) {
            await prisma.serviceOrder.updateMany({ where: { id: orderId, sodApprovalStage: STARTING }, data: { sodApprovalStage: SOD_STAGE_RESTART } });
            console.error(`[SodApproval] could not start the gate for ${orderId}:`, e);
            return { started: false, reason: e instanceof Error ? e.message : 'FAILED' };
        }
    }

    /** Orders marked for (re)start get their gate opened. Called before any list or action, so a missed start heals itself. */
    static async healPending(limit = 30, ids?: string[]) {
        const stale = new Date(Date.now() - 5 * 60_000);
        const rows = await prisma.serviceOrder.findMany({
            where: { ...(ids ? { id: { in: ids } } : {}), invoiced: false, OR: [{ sodApprovalStage: SOD_STAGE_RESTART }, { sodApprovalStage: STARTING, updatedAt: { lt: stale } }] },
            select: { id: true }, take: limit,
        });
        for (const r of rows) await this.startFor(r.id, 'Order changed');
        return rows.length;
    }

    /** The order left the finished statuses before the chain completed: close its open step. */
    static async cancel(orderId: string, reason: string) {
        const policy = await loadPolicy();
        if (!policy) return;
        await prisma.universalApprovalInstance.updateMany({
            where: { entityType: SOD_GATE.entityType, entityId: orderId, policyId: policy.id, status: 'PENDING' },
            data: { status: 'REJECTED', actionedAt: new Date(), comments: `${RESTART_PREFIX} ${reason}` },
        });
    }

    /** Orders waiting at a step this person holds, inside their area (or, for the contractor step, their own orders). */
    static async queue(userId: string, filter: { stage?: string; rtom?: string; q?: string } = {}) {
        await this.healPending(30);
        const policy = await loadPolicy();
        if (!policy || !policy.isEnabled) return { stages: [], counts: {}, orders: [] };
        const { actor, permissions } = await loadActor(userId);
        const levels = policy.approvalLevels as Level[];
        const mine = levels.filter((l) => holdsStep(actor, permissions, l));
        if (mine.length === 0) return { stages: [], counts: {}, orders: [] };
        const scope = await resolveOpmcScope(userId);
        const wanted = filter.stage ? mine.filter((l) => l.requiredRole === filter.stage) : mine;
        const q = filter.q?.trim();

        const instances = await prisma.universalApprovalInstance.findMany({
            where: { entityType: SOD_GATE.entityType, policyId: policy.id, status: 'PENDING', level: { in: mine.map((l) => l.level) } },
            select: { entityId: true, level: true }, take: 5000,
        });
        const byOrder = new Map(instances.map((i) => [i.entityId, i.level]));
        const orders = byOrder.size === 0 ? [] : await prisma.serviceOrder.findMany({
            where: {
                id: { in: [...byOrder.keys()] }, sodApprovalStage: { notIn: [SOD_STAGE_DONE, SOD_STAGE_RESTART, STARTING] },
                ...(filter.rtom ? { rtom: filter.rtom } : {}),
                ...(q ? { OR: [{ soNum: { contains: q, mode: 'insensitive' } }, { customerName: { contains: q, mode: 'insensitive' } }, { voiceNumber: { contains: q } }] } : {}),
            },
            orderBy: [{ completedDate: 'asc' }, { soNum: 'asc' }],
            select: {
                id: true, soNum: true, rtom: true, opmcId: true, contractorId: true, customerName: true, completedDate: true, sodApprovalStage: true,
                sltsPatStatus: true, opmcPatStatus: true, hoPatStatus: true, qcStatus: true, contractor: { select: { name: true } },
            },
        });
        const visible = orders.filter((o) => {
            const level = levels.find((l) => l.level === byOrder.get(o.id));
            if (!level) return false;
            if (level.assignee === 'ORDER_CONTRACTOR') return !!o.contractorId && o.contractorId === actor.contractorId;
            return scope === undefined || (!!o.opmcId && scope.includes(o.opmcId));
        });
        const counts: Record<string, number> = {};
        for (const o of visible) { const role = levels.find((l) => l.level === byOrder.get(o.id))!.requiredRole; counts[role] = (counts[role] ?? 0) + 1; }
        const shown = visible.filter((o) => wanted.some((l) => l.level === byOrder.get(o.id))).slice(0, 500);
        const history = await historyFor(shown.map((o) => o.id), policy.id);
        return {
            stages: mine.map((l) => ({ key: l.requiredRole, label: roleLabel(l.requiredRole) })),
            counts,
            orders: shown.map((o) => ({
                id: o.id, soNum: o.soNum, rtom: o.rtom, customerName: o.customerName, completedDate: o.completedDate, sodApprovalStage: o.sodApprovalStage, stageLabel: sodStageLabel(o.sodApprovalStage),
                sltsPatStatus: o.sltsPatStatus, opmcPatStatus: o.opmcPatStatus, hoPatStatus: o.hoPatStatus, qcStatus: o.qcStatus, contractor: o.contractor,
                approvals: (history.get(o.id) ?? []).map((h) => ({ stage: h.stage, action: h.action, note: h.note, createdAt: h.createdAt, user: { name: h.userName } })),
            })),
        };
    }

    /** What happens to each selected order for one person: the open step, whether they hold it, and the plan. */
    private static async judge(userId: string, ids: string[]) {
        const policy = await loadPolicy();
        if (!policy || !policy.isEnabled) throw AppError.badRequest('The SOD invoicing approval gate is not configured');
        const { actor, permissions } = await loadActor(userId);
        const levels = policy.approvalLevels as Level[];
        const scope = await resolveOpmcScope(userId);
        await this.healPending(ids.length, ids);
        const orders = await prisma.serviceOrder.findMany({ where: { id: { in: ids } }, select: { id: true, soNum: true, opmcId: true, contractorId: true, sodApprovalStage: true } });
        const open = await prisma.universalApprovalInstance.findMany({ where: { entityType: SOD_GATE.entityType, policyId: policy.id, status: 'PENDING', entityId: { in: ids } }, select: { id: true, entityId: true, level: true } });
        const history = await historyFor(ids, policy.id);
        return { policy, actor, permissions, levels, scope, orders, open, history };
    }

    /**
     * Approve the step each order is waiting at (one or many). Every order is judged on its own: the answer lists the ones that
     * moved on and the ones that could not, with the reason. The last step marks the order invoicable after checking it can be billed.
     */
    static async approve(userId: string, sodIds: string[], note?: string) {
        const ids = [...new Set(sodIds)];
        if (ids.length === 0) throw AppError.badRequest('Select at least one order');
        if (ids.length > MAX_BATCH) throw AppError.badRequest(`Approve at most ${MAX_BATCH} orders at a time`);
        const { actor, permissions, levels, scope, orders, open, history } = await this.judge(userId, ids);

        const approved: SodApprovalOutcome[] = [];
        const failed: SodApprovalOutcome[] = [];
        for (const id of ids) if (!orders.some((o) => o.id === id)) failed.push({ soNum: id, message: 'Order not found' });
        for (const o of orders) {
            const inst = open.find((i) => i.entityId === o.id);
            const level = inst ? levels.find((l) => l.level === inst.level) : undefined;
            const isContractorStep = level?.assignee === 'ORDER_CONTRACTOR';
            const plan = planApproval({
                waiting: !!inst && !!level, stageLabel: level ? roleLabel(level.requiredRole) : '-', userId,
                canAct: !!level && mayActOnLevel(actor, permissions, level, { contractorId: o.contractorId }),
                inScope: isContractorStep || scope === undefined || (!!o.opmcId && scope.includes(o.opmcId)),
                history: history.get(o.id) ?? [],
            });
            if (!plan.ok) { failed.push({ soNum: o.soNum, message: plan.message }); continue; }
            try {
                const res = await ProcessGateEngine.advanceGate({ instanceId: inst!.id, action: 'APPROVED', userId, remarks: note?.trim() || undefined });
                if (res.status === 'GATE_ADVANCED' && 'nextLevel' in res) {
                    const next = levels.find((l) => l.level === res.nextLevel);
                    if (next) await prisma.serviceOrder.update({ where: { id: o.id }, data: { sodApprovalStage: next.requiredRole } });
                    approved.push({ soNum: o.soNum, stage: next?.requiredRole });
                } else {
                    approved.push({ soNum: o.soNum, stage: SOD_STAGE_DONE });
                }
            } catch (e) {
                failed.push({ soNum: o.soNum, message: e instanceof Error ? e.message : 'Could not approve' });
            }
        }
        return { approved, failed };
    }

    /** Send orders back to the start of the chain with a reason (a person who holds the step they are waiting at may do this). */
    static async returnOrders(userId: string, sodIds: string[], note: string) {
        const reason = note?.trim() ?? '';
        if (reason.length < 3) throw AppError.badRequest('A reason is required to return an order');
        const ids = [...new Set(sodIds)];
        if (ids.length === 0) throw AppError.badRequest('Select at least one order');
        if (ids.length > MAX_BATCH) throw AppError.badRequest(`Return at most ${MAX_BATCH} orders at a time`);
        const { actor, permissions, levels, scope, orders, open } = await this.judge(userId, ids);

        const returned: SodApprovalOutcome[] = [];
        const failed: SodApprovalOutcome[] = [];
        for (const id of ids) if (!orders.some((o) => o.id === id)) failed.push({ soNum: id, message: 'Order not found' });
        for (const o of orders) {
            const inst = open.find((i) => i.entityId === o.id);
            const level = inst ? levels.find((l) => l.level === inst.level) : undefined;
            if (!inst || !level) { failed.push({ soNum: o.soNum, message: 'This order is not waiting for an approval' }); continue; }
            if (!mayActOnLevel(actor, permissions, level, { contractorId: o.contractorId })) { failed.push({ soNum: o.soNum, message: `Waiting for the ${roleLabel(level.requiredRole)}; you do not hold that step` }); continue; }
            if (level.assignee !== 'ORDER_CONTRACTOR' && scope !== undefined && (!o.opmcId || !scope.includes(o.opmcId))) { failed.push({ soNum: o.soNum, message: 'This order is outside your area' }); continue; }
            try {
                await ProcessGateEngine.advanceGate({ instanceId: inst.id, action: 'REJECTED', userId, remarks: reason });
                await prisma.serviceOrder.update({ where: { id: o.id }, data: { sodApprovalStage: SOD_STAGE_RESTART } });
                const restart = await this.startFor(o.id, `Returned: ${reason}`);
                returned.push({ soNum: o.soNum, stage: restart.stage ?? SOD_STAGE_RESTART });
            } catch (e) {
                failed.push({ soNum: o.soNum, message: e instanceof Error ? e.message : 'Could not return' });
            }
        }
        return { returned, failed };
    }
}

export { confirmationsSinceReturn };
