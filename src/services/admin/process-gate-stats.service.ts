import { prisma } from '@/lib/prisma';
import { AppError } from '@/lib/error';
import { deriveEffectivePermissions } from '@/lib/effective-permissions';
import { ADMIN_CAPABILITY, hasEligibleRole, mayActOnLevel, parseEligibleRoles } from '@/lib/gate-eligibility';
import { describeStep } from '@/lib/gate-plain-language';

export interface StepStats {
    level: number;
    /** items waiting at this step right now */
    waiting: number;
    /** active people who hold the step; null when it cannot be counted (a named person, or the item's own contractor) */
    holders: number | null;
    /** areas that have contractors but nobody holding the step (queue gates, role steps) */
    areasWithout: number | null;
    /** the names of those areas (at most 12) */
    missingAreas: string[];
}

export interface SimulatedStep {
    level: number;
    role: string;
    title: string;
    who: string;
    /** ACTIVE: somebody can act; SKIPPED: nobody holds it and the step is set to be skipped; NOBODY: nobody can act, the item waits here */
    outcome: 'ACTIVE' | 'SKIPPED' | 'NOBODY' | 'DEPENDS';
    people: string[];
    morePeople: number;
}

const PERSON_SELECT = {
    id: true, name: true, contractorId: true, permissions: true, accessibleOpmcs: { select: { id: true } },
    systemRole: { select: { code: true, isActive: true, permissions: true, rolePermissions: { select: { permission: true, permissionDefinition: { select: { code: true, isActive: true } } } } } },
    sectionAssignments: { select: { role: { select: { code: true, isActive: true, permissions: true, rolePermissions: { select: { permission: true, permissionDefinition: { select: { code: true, isActive: true } } } } } } } },
} as const;

async function loadPeople() {
    const users = await prisma.user.findMany({ where: { status: 'active' }, select: PERSON_SELECT });
    return users.map((u) => ({ u, permissions: deriveEffectivePermissions(u) }));
}

/** Live figures for the gate screen, and a dry run of a gate for one area. */
export class ProcessGateStatsService {
    static async forAllGates(): Promise<Record<string, StepStats[]>> {
        const [gates, waiting, people, contractorAreas] = await Promise.all([
            prisma.processGatePolicy.findMany({ select: { id: true, queueMode: true, approvalLevels: { where: { policyVariant: 'DEFAULT' }, orderBy: { level: 'asc' } } } }),
            prisma.universalApprovalInstance.groupBy({ by: ['policyId', 'level'], where: { status: 'PENDING', policyId: { not: null } }, _count: { _all: true } }),
            loadPeople(),
            prisma.contractor.findMany({ where: { opmcId: { not: null } }, distinct: ['opmcId'], select: { opmc: { select: { id: true, name: true, rtom: true } } } }),
        ]);
        const areas = contractorAreas.flatMap((c) => (c.opmc ? [c.opmc] : []));

        const out: Record<string, StepStats[]> = {};
        for (const gate of gates) {
            out[gate.id] = gate.approvalLevels.map((level) => {
                const waitingHere = waiting.find((w) => w.policyId === gate.id && w.level === level.level)?._count._all ?? 0;
                if (level.assignee === 'ORDER_CONTRACTOR' || level.specificUserId) return { level: level.level, waiting: waitingHere, holders: null, areasWithout: null, missingAreas: [] };
                const roles = parseEligibleRoles(level.eligibleRoles);
                const holders = people.filter(({ u, permissions }) => !!level.requiredPermission && permissions.includes(level.requiredPermission) && !permissions.includes(ADMIN_CAPABILITY) && hasEligibleRole(u, roles));
                const covered = new Set(holders.flatMap(({ u }) => u.accessibleOpmcs.map((o) => o.id)));
                const missing = gate.queueMode ? areas.filter((a) => !covered.has(a.id)) : [];
                return {
                    level: level.level, waiting: waitingHere, holders: holders.length,
                    areasWithout: gate.queueMode ? missing.length : null,
                    missingAreas: missing.slice(0, 12).map((a) => a.name || a.rtom),
                };
            });
        }
        return out;
    }

    /**
     * What would happen to an item of this gate in this area (and for this contractor): which steps apply, who could act on each, and
     * where it would wait for nobody. A step that belongs to the item's own contractor cannot be judged until a contractor is chosen (DEPENDS). Read-only.
     */
    static async simulate(gateId: string, scope: { opmcId?: string | null; contractorId?: string | null }): Promise<{ steps: SimulatedStep[]; stuckAt: number | null; areaName: string | null; contractorName: string | null }> {
        const gate = await prisma.processGatePolicy.findUnique({ where: { id: gateId }, select: { entityType: true, queueMode: true, approvalLevels: { where: { policyVariant: 'DEFAULT' }, orderBy: { level: 'asc' } } } });
        if (!gate) throw AppError.notFound('Process gate not found');
        const { contractorId } = scope;
        let opmcId = scope.opmcId;
        const contractor = contractorId ? await prisma.contractor.findUnique({ where: { id: contractorId }, select: { id: true, name: true, opmcId: true } }) : null;
        if (contractorId && !contractor) throw AppError.notFound('Contractor not found');
        if (!opmcId && contractor?.opmcId) opmcId = contractor.opmcId;
        const area = opmcId ? await prisma.oPMC.findUnique({ where: { id: opmcId }, select: { name: true, rtom: true } }) : null;
        if (gate.queueMode && !opmcId) throw AppError.badRequest('Choose an area (or a contractor) to test this gate.');
        const people = await loadPeople();

        const steps: SimulatedStep[] = gate.approvalLevels.map((level) => {
            const d = describeStep({ requiredRole: level.requiredRole, assignee: level.assignee, skipIfNoApprover: level.skipIfNoApprover, specificUserId: level.specificUserId }, { queueMode: gate.queueMode, entityType: gate.entityType });
            const holders = people.filter(({ u, permissions }) => {
                if (permissions.includes(ADMIN_CAPABILITY)) return false;
                const actor = { ...u, accessibleOpmcIds: u.accessibleOpmcs.map((o) => o.id) };
                return mayActOnLevel(actor, permissions, level, { opmcId: gate.queueMode ? opmcId : null, contractorId });
            });
            const named = holders.map(({ u }) => u.name ?? 'Unnamed user');
            const outcome: SimulatedStep['outcome'] = level.assignee === 'ORDER_CONTRACTOR' && !contractorId ? 'DEPENDS' : holders.length > 0 ? 'ACTIVE' : level.skipIfNoApprover ? 'SKIPPED' : 'NOBODY';
            return { level: level.level, role: level.requiredRole, title: d.title, who: d.who, outcome, people: named.slice(0, 5), morePeople: Math.max(0, named.length - 5) };
        });
        const stuck = steps.find((s) => s.outcome === 'NOBODY');
        return { steps, stuckAt: stuck ? stuck.level : null, areaName: area ? (area.name || area.rtom) : null, contractorName: contractor?.name ?? null };
    }
}
