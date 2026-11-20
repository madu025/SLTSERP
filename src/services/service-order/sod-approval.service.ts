import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { AppError } from '@/lib/error';
import { resolveOpmcScope } from '@/lib/opmc-scope';
import { narrowScope } from './area-overview.service';
import { deriveEffectivePermissions } from '@/lib/effective-permissions';
import { mayActOnLevel, roleLabel, type GateActor } from '@/lib/gate-eligibility';
import { ProcessGateEngine } from '@/services/approval/process-gate-engine';
import { confirmationsSinceReturn, planApproval, type ApprovalHistoryEntry } from '@/lib/approval-chain-rules';
import {
    SOD_CHAIN_ENTRY_STATUSES, SOD_GATE, SOD_PHOTO_CHECK_MESSAGE, SOD_MATERIAL_CHECK_MESSAGE, SOD_PHOTO_CHECK_NOTE, SOD_PAT_OK, SOD_PAT_WAITING_MESSAGE, PAT_PASSED_VALUES, patSatisfied, SOD_PHOTO_CHECK_ROLE, SOD_READY_STAGES, SOD_STAGE_READY, SOD_STAGE_RESTART, SOD_STAGE_STARTING, sodStageLabel,
} from '@/lib/sod-approval-rules';

const MAX_BATCH = 200;
const START_CHUNK = 1000;
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

/** Every approval, return and restart of the given orders, oldest first, from the gate and from the earlier hard-coded chain. */
export async function sodHistoryFor(orderIds: string[], policyId?: string): Promise<Map<string, HistoryRow[]>> {
    const out = new Map<string, HistoryRow[]>();
    if (orderIds.length === 0) return out;
    const [instances, legacy] = await Promise.all([
        prisma.universalApprovalInstance.findMany({
            where: { entityType: SOD_GATE.entityType, entityId: { in: orderIds }, ...(policyId ? { policyId } : {}), status: { in: ['APPROVED', 'REJECTED'] } },
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

export interface SodQueueFilter { stage?: string; rtom?: string; q?: string; month?: number; year?: number; contractorId?: string; limit?: number }

/** The month an order was completed in, as a half-open date range. */
export function monthRange(month: number, year: number) {
    return { gte: new Date(year, month - 1, 1), lt: new Date(year, month, 1) };
}

export class SodApprovalService {
    /**
     * Opens the first step of the gate for finished orders that are not in the chain yet (set-based: one insert for all of them, no
     * assignee, no mail). Only orders of a contractor that are not invoiced enter. Safe to call twice: an order with an open step is skipped.
     */
    static async startMany(orderIds: string[]): Promise<number> {
        if (orderIds.length === 0) return 0;
        const policy = await loadPolicy();
        const first = policy?.approvalLevels[0];
        if (!policy || !policy.isEnabled || !first) return 0;
        const open = await prisma.universalApprovalInstance.findMany({ where: { entityType: SOD_GATE.entityType, policyId: policy.id, status: 'PENDING', entityId: { in: orderIds } }, select: { entityId: true } });
        const skip = new Set(open.map((o) => o.entityId));
        const ids = orderIds.filter((id) => !skip.has(id));
        if (ids.length === 0) return 0;
        await prisma.$transaction(async (tx) => {
            await tx.universalApprovalInstance.createMany({
                data: ids.map((entityId) => ({
                    entityType: SOD_GATE.entityType, entityId, policyId: policy.id, levelIndex: first.level - 1, level: first.level, requiredRole: first.requiredRole,
                    requiredPermission: first.requiredPermission, eligibleRoles: first.eligibleRoles ?? undefined, policyVariant: 'DEFAULT', status: 'PENDING',
                })),
            });
            await tx.serviceOrder.updateMany({ where: { id: { in: ids } }, data: { sodApprovalStage: first.requiredRole, isInvoicable: false } });
        }, { timeout: 60_000, maxWait: 10_000 });
        return ids.length;
    }

    /**
     * Brings the finished orders of the caller's area into the chain. Called before a queue is read or an action is taken, so nothing
     * has to be started by a status hook and an order that was missed is picked up the next time anyone looks.
     */
    static async ensureStarted(scope: string[] | undefined, extra: { ids?: string[] } = {}): Promise<number> {
        if (scope !== undefined && scope.length === 0) return 0;
        const stale = new Date(Date.now() - 5 * 60_000);
        const rows = await prisma.serviceOrder.findMany({
            where: {
                ...(extra.ids ? { id: { in: extra.ids } } : {}),
                ...(scope === undefined ? {} : { opmcId: { in: scope } }),
                invoiced: false, contractorId: { not: null }, status: { in: [...SOD_CHAIN_ENTRY_STATUSES] },
                AND: [SOD_PAT_OK, { OR: [{ sodApprovalStage: null }, { sodApprovalStage: SOD_STAGE_RESTART }, { sodApprovalStage: SOD_STAGE_STARTING, updatedAt: { lt: stale } }] }],
            },
            select: { id: true }, take: START_CHUNK,
        });
        return this.startMany(rows.map((r) => r.id));
    }

    /** Orders waiting at a step this person holds, inside their area. */
    static async queue(userId: string, filter: SodQueueFilter = {}) {
        const scope = await resolveOpmcScope(userId);
        await this.ensureStarted(scope);
        const policy = await loadPolicy();
        if (!policy || !policy.isEnabled) return { stages: [], counts: {}, orders: [] as never[], total: 0 };
        const { actor, permissions } = await loadActor(userId);
        const levels = policy.approvalLevels as Level[];
        const mine = levels.filter((l) => mayActOnLevel(actor, permissions, l));
        if (mine.length === 0) return { stages: [], counts: {}, orders: [] as never[], total: 0 };
        const wanted = filter.stage ? mine.filter((l) => l.requiredRole === filter.stage) : mine;
        const q = filter.q?.trim();
        const limit = Math.min(filter.limit ?? 300, 500);

        const inMySteps = {
            sodApprovalStage: { in: mine.map((l) => l.requiredRole) },
            ...(scope === undefined ? {} : { opmcId: { in: scope } }),
            ...(filter.rtom ? { rtom: filter.rtom } : {}),
            ...(filter.contractorId ? { contractorId: filter.contractorId } : {}),
            ...(filter.month && filter.year ? { completedDate: monthRange(filter.month, filter.year) } : {}),
        };
        // Only orders whose PAT approvals have all passed are worked on here: the order could not be invoiced before that, so the people
        // who pass it would be spending their time on an order that stops at the last step. The others are counted and shown as waiting.
        const base = { ...inMySteps, AND: [SOD_PAT_OK, ...(q ? [{ OR: [{ soNum: { contains: q, mode: 'insensitive' as const } }, { customerName: { contains: q, mode: 'insensitive' as const } }, { voiceNumber: { contains: q } }] }] : [])] };
        const [byStage, orders, awaitingPat] = await Promise.all([
            prisma.serviceOrder.groupBy({ by: ['sodApprovalStage'], where: base, _count: { _all: true } }),
            prisma.serviceOrder.findMany({
                where: { ...base, sodApprovalStage: { in: wanted.map((l) => l.requiredRole) } },
                orderBy: [{ completedDate: 'asc' }, { soNum: 'asc' }], take: limit,
                select: {
                    id: true, soNum: true, rtom: true, opmcId: true, contractorId: true, customerName: true, completedDate: true, sodApprovalStage: true, revenueAmount: true, contractorAmount: true,
                    sltsPatStatus: true, opmcPatStatus: true, hoPatStatus: true, qcStatus: true, contractor: { select: { name: true } },
                    _count: { select: { materialUsage: true } },
                },
            }),
            prisma.serviceOrder.count({ where: { ...inMySteps, NOT: SOD_PAT_OK } }),
        ]);
        const counts: Record<string, number> = {};
        for (const g of byStage) if (g.sodApprovalStage) counts[g.sodApprovalStage] = g._count._all;
        const history = await sodHistoryFor(orders.map((o) => o.id), policy.id);
        return {
            stages: mine.map((l) => ({ key: l.requiredRole, label: roleLabel(l.requiredRole) })),
            counts, awaitingPat,
            total: wanted.reduce((a, l) => a + (counts[l.requiredRole] ?? 0), 0),
            orders: orders.map((o) => ({
                id: o.id, soNum: o.soNum, rtom: o.rtom, customerName: o.customerName, completedDate: o.completedDate, sodApprovalStage: o.sodApprovalStage, stageLabel: sodStageLabel(o.sodApprovalStage),
                contractorAmount: o.contractorAmount === null ? null : Number(o.contractorAmount),
                sltsPatStatus: o.sltsPatStatus, opmcPatStatus: o.opmcPatStatus, hoPatStatus: o.hoPatStatus, qcStatus: o.qcStatus, contractor: o.contractor, materialLines: o._count.materialUsage,
                approvals: (history.get(o.id) ?? []).map((h) => ({ stage: h.stage, action: h.action, note: h.note, createdAt: h.createdAt, user: { name: h.userName } })),
            })),
        };
    }

    /**
     * What waits for this person, for the dashboard: how many orders are at each step they hold, how many completed orders are waiting for their
     * PAT, and (for the first step) the finished orders that have not been brought into the chain yet. It only reads: nothing is started here.
     */
    static async summary(userId: string, rtom?: string) {
        const none = { total: 0, slts: 0, opmc: 0, ho: 0, rejected: 0 };
        const empty = { stages: [] as Array<{ key: string; label: string; count: number }>, awaitingPat: none };
        const allScope = await resolveOpmcScope(userId);
        if (allScope !== undefined && allScope.length === 0) return empty;
        const scope = allScope === undefined ? undefined : await narrowScope(allScope, rtom);
        const policy = await loadPolicy();
        if (!policy || !policy.isEnabled) return empty;
        const { actor, permissions } = await loadActor(userId);
        const levels = policy.approvalLevels as Level[];
        const mine = levels.filter((l) => mayActOnLevel(actor, permissions, l));
        if (mine.length === 0) return empty;
        const area = scope === undefined ? {} : { opmcId: { in: scope } };
        const roles = mine.map((l) => l.requiredRole);
        const firstLevel = levels[0].level;
        const holdsFirst = mine.some((l) => l.level === firstLevel);
        const [byStage, patRows, notStarted] = await Promise.all([
            prisma.serviceOrder.groupBy({ by: ['sodApprovalStage'], where: { ...area, sodApprovalStage: { in: roles }, AND: [SOD_PAT_OK] }, _count: { _all: true } }),
            // Finished orders of the area that wait for a PAT approval, by the approval they wait for (SLTS, then OPMC, then HO; a rejection comes first).
            // Orders that are not in the approval chain yet are counted too: they join it when the PAT has passed.
            prisma.$queryRaw<Array<{ what: string; n: number }>>(Prisma.sql`
                select case
                    when s."sltsPatStatus"::text ilike '%REJECT%' or s."opmcPatStatus"::text ilike '%REJECT%' or s."hoPatStatus"::text ilike '%REJECT%' then 'rejected'
                    when s."sltsPatStatus"::text <> all(${[...PAT_PASSED_VALUES]}::text[]) then 'slts'
                    when s."opmcPatStatus"::text <> all(${[...PAT_PASSED_VALUES]}::text[]) then 'opmc'
                    else 'ho' end as what, count(*)::int as n
                from "ServiceOrder" s
                where s.invoiced = false and s."contractorId" is not null and s."isManualEntry" = false
                  and s.status::text = any(${[...SOD_CHAIN_ENTRY_STATUSES]}::text[])
                  and (s."sodApprovalStage" is null or s."sodApprovalStage" <> all(${[...SOD_READY_STAGES]}::text[]))
                  and not (s."sltsPatStatus"::text = any(${[...PAT_PASSED_VALUES]}::text[]) and s."opmcPatStatus"::text = any(${[...PAT_PASSED_VALUES]}::text[]) and s."hoPatStatus"::text = any(${[...PAT_PASSED_VALUES]}::text[]))
                  ${scope === undefined ? Prisma.empty : Prisma.sql`and s."opmcId" = any(${scope}::uuid[])`}
                group by 1`),
            holdsFirst
                ? prisma.serviceOrder.count({ where: { ...area, invoiced: false, contractorId: { not: null }, status: { in: [...SOD_CHAIN_ENTRY_STATUSES] }, AND: [SOD_PAT_OK, { OR: [{ sodApprovalStage: null }, { sodApprovalStage: SOD_STAGE_RESTART }] }] } })
                : Promise.resolve(0),
        ]);
        const counts = new Map(byStage.map((g) => [g.sodApprovalStage, g._count._all]));
        const pat = { ...{ total: 0, slts: 0, opmc: 0, ho: 0, rejected: 0 } };
        for (const r of patRows) { const n = Number(r.n); pat.total += n; if (r.what === 'slts') pat.slts = n; else if (r.what === 'opmc') pat.opmc = n; else if (r.what === 'ho') pat.ho = n; else pat.rejected = n; }
        return {
            stages: mine.map((l) => ({ key: l.requiredRole, label: roleLabel(l.requiredRole), count: (counts.get(l.requiredRole) ?? 0) + (l.level === firstLevel ? notStarted : 0) })),
            awaitingPat: pat,
        };
    }

    /** What happens to each selected order for one person: the open step, whether they hold it, and the plan. */
    private static async judge(userId: string, ids: string[]) {
        const policy = await loadPolicy();
        if (!policy || !policy.isEnabled) throw AppError.badRequest('The order approval gate is not configured');
        const { actor, permissions } = await loadActor(userId);
        const levels = policy.approvalLevels as Level[];
        const scope = await resolveOpmcScope(userId);
        await this.ensureStarted(scope, { ids });
        const orders = await prisma.serviceOrder.findMany({ where: { id: { in: ids } }, select: { id: true, soNum: true, opmcId: true, contractorId: true, sodApprovalStage: true, sltsPatStatus: true, opmcPatStatus: true, hoPatStatus: true, isManualEntry: true } });
        const open = await prisma.universalApprovalInstance.findMany({ where: { entityType: SOD_GATE.entityType, policyId: policy.id, status: 'PENDING', entityId: { in: ids } }, select: { id: true, entityId: true, level: true } });
        const history = await sodHistoryFor(ids, policy.id);
        return { policy, actor, permissions, levels, scope, orders, open, history };
    }

    /**
     * Approve the step each order is waiting at (one or many). Every order is judged on its own: the answer lists the ones that moved on
     * and the ones that could not, with the reason. The last step makes the order ready for the engineer.
     */
    static async approve(userId: string, sodIds: string[], note?: string, photosChecked?: boolean) {
        const ids = [...new Set(sodIds)];
        if (ids.length === 0) throw AppError.badRequest('Select at least one order');
        if (ids.length > MAX_BATCH) throw AppError.badRequest(`Approve at most ${MAX_BATCH} orders at a time`);
        const { actor, permissions, levels, scope, orders, open, history } = await this.judge(userId, ids);

        const materialLines = new Map((await prisma.serviceOrder.findMany({ where: { id: { in: ids } }, select: { id: true, _count: { select: { materialUsage: true } } } })).map((m) => [m.id, m._count.materialUsage]));
        const approved: SodApprovalOutcome[] = [];
        const failed: SodApprovalOutcome[] = [];
        for (const id of ids) if (!orders.some((o) => o.id === id)) failed.push({ soNum: id, message: 'Order not found' });
        for (const o of orders) {
            const inst = open.find((i) => i.entityId === o.id);
            const level = inst ? levels.find((l) => l.level === inst.level) : undefined;
            const plan = planApproval({
                waiting: !!inst && !!level, stageLabel: level ? roleLabel(level.requiredRole) : '-', userId,
                canAct: !!level && mayActOnLevel(actor, permissions, level, { opmcId: o.opmcId }),
                inScope: scope === undefined || (!!o.opmcId && scope.includes(o.opmcId)),
                history: history.get(o.id) ?? [], noun: 'order',
            });
            if (!plan.ok) { failed.push({ soNum: o.soNum, message: plan.message }); continue; }
            if (!patSatisfied(o)) { failed.push({ soNum: o.soNum, message: SOD_PAT_WAITING_MESSAGE }); continue; }
            // The QC Officer's step is the check that the photos of the order were received: it cannot be passed without saying so, and the
            // statement is kept in the order's approval history with who made it.
            const photoCheck = level?.requiredRole === SOD_PHOTO_CHECK_ROLE;
            if (photoCheck && (materialLines.get(o.id) ?? 0) === 0) { failed.push({ soNum: o.soNum, message: SOD_MATERIAL_CHECK_MESSAGE }); continue; }
            if (photoCheck && photosChecked !== true) { failed.push({ soNum: o.soNum, message: SOD_PHOTO_CHECK_MESSAGE }); continue; }
            const remarks = [photoCheck ? SOD_PHOTO_CHECK_NOTE : '', note?.trim() ?? ''].filter(Boolean).join(' - ') || undefined;
            try {
                const res = await ProcessGateEngine.advanceGate({ instanceId: inst!.id, action: 'APPROVED', userId, remarks });
                if (res.status === 'GATE_ADVANCED' && 'nextLevel' in res) {
                    const next = levels.find((l) => l.level === res.nextLevel);
                    if (next) await prisma.serviceOrder.update({ where: { id: o.id }, data: { sodApprovalStage: next.requiredRole } });
                    approved.push({ soNum: o.soNum, stage: next?.requiredRole });
                } else {
                    approved.push({ soNum: o.soNum, stage: SOD_STAGE_READY });
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
            if (!mayActOnLevel(actor, permissions, level, { opmcId: o.opmcId })) { failed.push({ soNum: o.soNum, message: `Waiting for the ${roleLabel(level.requiredRole)}; you do not hold that step` }); continue; }
            if (scope !== undefined && (!o.opmcId || !scope.includes(o.opmcId))) { failed.push({ soNum: o.soNum, message: 'This order is outside your area' }); continue; }
            try {
                await ProcessGateEngine.advanceGate({ instanceId: inst.id, action: 'REJECTED', userId, remarks: reason });
                await prisma.serviceOrder.update({ where: { id: o.id }, data: { sodApprovalStage: SOD_STAGE_RESTART } });
                await this.startMany([o.id]);
                returned.push({ soNum: o.soNum, stage: levels[0]?.requiredRole ?? SOD_STAGE_RESTART });
            } catch (e) {
                failed.push({ soNum: o.soNum, message: e instanceof Error ? e.message : 'Could not return' });
            }
        }
        return { returned, failed };
    }

    /** The engineer sends orders that are ready back to the start of the chain (a quality problem), with a reason. */
    static async returnReady(orderIds: string[], userId: string, reason: string, scope: string[] | undefined) {
        const ids = [...new Set(orderIds)];
        const why = reason.trim();
        if (why.length < 3) throw AppError.badRequest('A reason is required');
        const policy = await loadPolicy();
        const orders = await prisma.serviceOrder.findMany({ where: { id: { in: ids }, invoiced: false, sodApprovalStage: { in: [...SOD_READY_STAGES] }, ...(scope === undefined ? {} : { opmcId: { in: scope } }) }, select: { id: true, soNum: true } });
        if (orders.length === 0) throw AppError.badRequest('None of these orders is ready for invoicing in your area');
        await prisma.$transaction(async (tx) => {
            await tx.serviceOrder.updateMany({ where: { id: { in: orders.map((o) => o.id) } }, data: { sodApprovalStage: SOD_STAGE_RESTART, invoicingHeldAt: null, invoicingHoldReason: null } });
            if (policy) {
                await tx.universalApprovalInstance.createMany({
                    data: orders.map((o) => ({ entityType: SOD_GATE.entityType, entityId: o.id, policyId: policy.id, levelIndex: 0, level: 0, requiredRole: 'RETURNED', policyVariant: 'DEFAULT', status: 'REJECTED', actionedById: userId, actionedAt: new Date(), comments: `${RESTART_PREFIX} Returned by the engineer: ${why}` })),
                });
            }
            await tx.auditLog.createMany({ data: orders.map((o) => ({ action: 'SOD_RETURNED_BY_ENGINEER', entity: 'ServiceOrder', entityId: o.id, userId, newValue: { soNum: o.soNum, reason: why } })) });
        }, { timeout: 60_000, maxWait: 10_000 });
        await this.startMany(orders.map((o) => o.id));
        return { returned: orders.length };
    }
}

export { confirmationsSinceReturn };
