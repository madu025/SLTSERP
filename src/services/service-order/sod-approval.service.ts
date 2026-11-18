import { prisma } from '@/lib/prisma';
import { AppError } from '@/lib/error';
import { resolveOpmcScope } from '@/lib/opmc-scope';
import { userHasPermission } from '@/lib/user-permissions';
import { STAGE_PERMISSION, type ConfirmStage } from '@/lib/invoice-confirm-rules';
import { SOD_APPROVAL_LABEL, SOD_APPROVAL_STAGES, SOD_APPROVAL_START, planApproval, type SodApprovalStage } from '@/lib/sod-approval-rules';
import { validateSodForInvoicing } from '@/services/service-order/sod-financial-validation';

const MAX_BATCH = 200;

/** Does the area (OPMC) have anybody who can approve as Area Engineer / Officer? When not, that stage is skipped. */
async function areaHasEngineer(opmcId: string | null): Promise<boolean> {
    if (!opmcId) return false;
    const code = STAGE_PERMISSION.AREA_ENGINEER;
    const count = await prisma.user.count({
        where: {
            status: 'active',
            accessibleOpmcs: { some: { id: opmcId } },
            systemRole: { isActive: true, rolePermissions: { some: { OR: [{ permission: code }, { permissionDefinition: { code } }] } } },
        },
    });
    return count > 0;
}

async function stagesOf(userId: string): Promise<ConfirmStage[]> {
    const stages: ConfirmStage[] = [];
    for (const stage of SOD_APPROVAL_STAGES) if (await userHasPermission(userId, STAGE_PERMISSION[stage])) stages.push(stage);
    return stages;
}

export interface SodApprovalOutcome { soNum: string; stage?: string; message?: string }

export class SodApprovalService {
    /** Orders waiting at a stage the user may act on, inside the user's OPMC scope. */
    static async queue(userId: string, filter: { stage?: string; rtom?: string; q?: string } = {}) {
        const stages = await stagesOf(userId);
        if (stages.length === 0) return { stages: [], counts: {}, orders: [] };
        const scope = await resolveOpmcScope(userId);
        const scopeWhere = scope !== undefined ? { opmcId: { in: [...scope] } } : {};
        const wanted = filter.stage && (stages as string[]).includes(filter.stage) ? [filter.stage] : stages;
        const q = filter.q?.trim();
        const [orders, grouped] = await Promise.all([
            prisma.serviceOrder.findMany({
                where: {
                    sodApprovalStage: { in: wanted },
                    ...scopeWhere,
                    ...(filter.rtom ? { rtom: filter.rtom } : {}),
                    ...(q ? { OR: [{ soNum: { contains: q, mode: 'insensitive' } }, { customerName: { contains: q, mode: 'insensitive' } }, { voiceNumber: { contains: q } }] } : {}),
                },
                orderBy: [{ completedDate: 'asc' }, { soNum: 'asc' }],
                take: 500,
                select: {
                    id: true, soNum: true, rtom: true, customerName: true, completedDate: true, sodApprovalStage: true,
                    sltsPatStatus: true, opmcPatStatus: true, hoPatStatus: true, qcStatus: true,
                    contractor: { select: { name: true } },
                    approvals: { orderBy: { createdAt: 'asc' }, select: { stage: true, action: true, note: true, createdAt: true, user: { select: { name: true } } } },
                },
            }),
            prisma.serviceOrder.groupBy({ by: ['sodApprovalStage'], where: { sodApprovalStage: { in: stages }, ...scopeWhere }, _count: { _all: true } }),
        ]);
        const counts = Object.fromEntries(grouped.map((g) => [g.sodApprovalStage as string, g._count._all]));
        return { stages, counts, orders };
    }

    /**
     * Approve the stage each order is waiting at (one or many). Every order is judged on its own: the answer lists the
     * ones that moved on and the ones that could not, with the reason. At the last stage the order is checked for
     * billing (contractor, completion date, amounts, PAT, material cost) and becomes invoicable.
     */
    static async approve(userId: string, sodIds: string[], note?: string) {
        const ids = [...new Set(sodIds)];
        if (ids.length === 0) throw AppError.badRequest('Select at least one order');
        if (ids.length > MAX_BATCH) throw AppError.badRequest(`Approve at most ${MAX_BATCH} orders at a time`);
        const userStages = new Set<string>(await stagesOf(userId));
        if (userStages.size === 0) throw AppError.forbidden('You do not hold any stage of the approval chain');
        const scope = await resolveOpmcScope(userId);

        const orders = await prisma.serviceOrder.findMany({
            where: { id: { in: ids } },
            select: {
                id: true, soNum: true, opmcId: true, sodApprovalStage: true, contractorId: true, completedDate: true, revenueAmount: true, contractorAmount: true,
                sltsPatStatus: true, opmcPatStatus: true, hoPatStatus: true, invoiced: true,
                materialUsage: { select: { quantity: true, unitPrice: true, costPrice: true } },
                approvals: { orderBy: { createdAt: 'asc' }, select: { userId: true, stage: true, action: true } },
            },
        });

        const approved: SodApprovalOutcome[] = [];
        const failed: SodApprovalOutcome[] = [];
        const engineerByArea = new Map<string, boolean>();
        for (const id of ids) if (!orders.some((o) => o.id === id)) failed.push({ soNum: id, message: 'Order not found' });

        for (const o of orders) {
            const inScope = scope === undefined || (!!o.opmcId && scope.includes(o.opmcId));
            let hasEngineer = false;
            if (o.opmcId) {
                if (!engineerByArea.has(o.opmcId)) engineerByArea.set(o.opmcId, await areaHasEngineer(o.opmcId));
                hasEngineer = engineerByArea.get(o.opmcId)!;
            }
            const plan = planApproval({ stage: o.sodApprovalStage, userId, userStages, inScope, history: o.approvals, areaHasEngineer: hasEngineer });
            if (!plan.ok) { failed.push({ soNum: o.soNum, message: plan.message }); continue; }
            const stage = o.sodApprovalStage as ConfirmStage;

            if (plan.next === 'CONFIRMED') {
                // The last approval makes the order billable, so it must already be billable
                const check = validateSodForInvoicing(o);
                if (o.invoiced || !check.eligible) {
                    failed.push({ soNum: o.soNum, message: o.invoiced ? 'Already invoiced' : `Cannot be billed yet: ${check.reasons.join(', ')}` });
                    continue;
                }
            }
            await prisma.$transaction([
                prisma.sodApproval.create({ data: { serviceOrderId: o.id, stage, action: 'CONFIRMED', userId, note: note?.trim() || null } }),
                prisma.serviceOrder.update({ where: { id: o.id }, data: plan.next === 'CONFIRMED' ? { sodApprovalStage: 'CONFIRMED', isInvoicable: true } : { sodApprovalStage: plan.next } }),
                prisma.auditLog.create({ data: { action: plan.next === 'CONFIRMED' ? 'SOD_APPROVAL_COMPLETED' : 'SOD_APPROVAL_STAGE', entity: 'ServiceOrder', entityId: o.id, userId, newValue: { soNum: o.soNum, stage, next: plan.next, note: note?.trim() || null } } }),
            ]);
            approved.push({ soNum: o.soNum, stage: plan.next });
        }
        return { approved, failed };
    }

    /** Send orders back to the start of the chain with a reason (a person at the stage they are waiting at may do this). */
    static async returnOrders(userId: string, sodIds: string[], note: string) {
        const reason = note?.trim() ?? '';
        if (reason.length < 3) throw AppError.badRequest('A reason is required to return an order');
        const ids = [...new Set(sodIds)];
        if (ids.length === 0) throw AppError.badRequest('Select at least one order');
        if (ids.length > MAX_BATCH) throw AppError.badRequest(`Return at most ${MAX_BATCH} orders at a time`);
        const userStages = new Set<string>(await stagesOf(userId));
        if (userStages.size === 0) throw AppError.forbidden('You do not hold any stage of the approval chain');
        const scope = await resolveOpmcScope(userId);
        const orders = await prisma.serviceOrder.findMany({ where: { id: { in: ids } }, select: { id: true, soNum: true, opmcId: true, sodApprovalStage: true } });

        const returned: SodApprovalOutcome[] = [];
        const failed: SodApprovalOutcome[] = [];
        for (const o of orders) {
            const stage = o.sodApprovalStage;
            if (!stage || stage === 'CONFIRMED' || !userStages.has(stage)) { failed.push({ soNum: o.soNum, message: !stage || stage === 'CONFIRMED' ? 'This order is not waiting for an approval' : `Waiting for the ${SOD_APPROVAL_LABEL[stage as ConfirmStage]}; you do not hold that role` }); continue; }
            if (scope !== undefined && (!o.opmcId || !scope.includes(o.opmcId))) { failed.push({ soNum: o.soNum, message: 'This order is outside your area' }); continue; }
            await prisma.$transaction([
                prisma.sodApproval.create({ data: { serviceOrderId: o.id, stage, action: 'RETURNED', userId, note: reason } }),
                prisma.serviceOrder.update({ where: { id: o.id }, data: { sodApprovalStage: SOD_APPROVAL_START } }),
                prisma.auditLog.create({ data: { action: 'SOD_APPROVAL_RETURNED', entity: 'ServiceOrder', entityId: o.id, userId, newValue: { soNum: o.soNum, stage, note: reason } } }),
            ]);
            returned.push({ soNum: o.soNum, stage: SOD_APPROVAL_START });
        }
        for (const id of ids) if (!orders.some((o) => o.id === id)) failed.push({ soNum: id, message: 'Order not found' });
        return { returned, failed };
    }
}

export type { SodApprovalStage };
