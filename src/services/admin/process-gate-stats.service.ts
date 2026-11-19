import { prisma } from '@/lib/prisma';
import { deriveEffectivePermissions } from '@/lib/effective-permissions';
import { ADMIN_CAPABILITY, hasEligibleRole, parseEligibleRoles } from '@/lib/gate-eligibility';

export interface StepStats {
    level: number;
    /** items waiting at this step right now */
    waiting: number;
    /** active people who hold the step; null when it cannot be counted (a named person, or the item's own contractor) */
    holders: number | null;
    /** areas that have contractors but nobody holding the step (queue gates, role steps) */
    areasWithout: number | null;
}

/** Live figures for the gate screen: how many items wait at each step and who is able to act on it. */
export class ProcessGateStatsService {
    static async forAllGates(): Promise<Record<string, StepStats[]>> {
        const [gates, waiting, users, contractorAreas] = await Promise.all([
            prisma.processGatePolicy.findMany({ select: { id: true, queueMode: true, approvalLevels: { where: { policyVariant: 'DEFAULT' }, orderBy: { level: 'asc' } } } }),
            prisma.universalApprovalInstance.groupBy({ by: ['policyId', 'level'], where: { status: 'PENDING', policyId: { not: null } }, _count: { _all: true } }),
            prisma.user.findMany({
                where: { status: 'active' },
                select: {
                    id: true, permissions: true, accessibleOpmcs: { select: { id: true } },
                    systemRole: { select: { code: true, isActive: true, permissions: true, rolePermissions: { select: { permission: true, permissionDefinition: { select: { code: true, isActive: true } } } } } },
                    sectionAssignments: { select: { role: { select: { code: true, isActive: true, permissions: true, rolePermissions: { select: { permission: true, permissionDefinition: { select: { code: true, isActive: true } } } } } } } },
                },
            }),
            prisma.contractor.findMany({ where: { opmcId: { not: null } }, distinct: ['opmcId'], select: { opmcId: true } }),
        ]);
        const areas = contractorAreas.map((c) => c.opmcId as string);
        const people = users.map((u) => ({ u, permissions: deriveEffectivePermissions(u) }));

        const out: Record<string, StepStats[]> = {};
        for (const gate of gates) {
            out[gate.id] = gate.approvalLevels.map((level) => {
                const waitingHere = waiting.find((w) => w.policyId === gate.id && w.level === level.level)?._count._all ?? 0;
                if (level.assignee === 'ORDER_CONTRACTOR' || level.specificUserId) return { level: level.level, waiting: waitingHere, holders: null, areasWithout: null };
                const roles = parseEligibleRoles(level.eligibleRoles);
                const holders = people.filter(({ u, permissions }) => !!level.requiredPermission && permissions.includes(level.requiredPermission) && !permissions.includes(ADMIN_CAPABILITY) && hasEligibleRole(u, roles));
                const covered = new Set(holders.flatMap(({ u }) => u.accessibleOpmcs.map((o) => o.id)));
                return {
                    level: level.level, waiting: waitingHere, holders: holders.length,
                    areasWithout: gate.queueMode ? areas.filter((a) => !covered.has(a)).length : null,
                };
            });
        }
        return out;
    }
}
