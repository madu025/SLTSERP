/**
 * Who may act on a step of a process gate. Pure, so the rule is testable and the gate engine, the approvals queue and the
 * contractor portal all use the same one.
 *
 * - A step names a capability (`requiredPermission`); the actor must hold it.
 * - assignee ROLE: the actor holds an eligible role, or is the step's named person, or administers RBAC.
 * - assignee ORDER_CONTRACTOR: the actor belongs to the contractor the order is assigned to (an administrator does not stand
 *   in for the contractor).
 * - In a gate with an area (scope.opmcId), a person who is not an administrator must have that area (OPMC) assigned.
 */
export interface RoleRef { code: string; isActive: boolean }
export interface ActorRoles {
    systemRole?: RoleRef | null;
    sectionAssignments: Array<{ role: RoleRef }>;
}
export interface GateScope { opmcId?: string | null; contractorId?: string | null }
export interface LevelRef {
    assignee?: string | null;
    requiredPermission: string | null;
    eligibleRoles: unknown;
    specificUserId?: string | null;
}
export type GateActor = ActorRoles & { id: string; contractorId?: string | null; accessibleOpmcIds?: readonly string[] };

export const ADMIN_CAPABILITY = 'admin.rbac';

export function parseEligibleRoles(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return value
        .filter((role): role is string => typeof role === 'string' && role.trim().length > 0)
        .map((role) => role.trim().replace(/_GLOBAL$/, ''));
}

export function hasEligibleRole(actor: ActorRoles, eligibleRoles: readonly string[]): boolean {
    if (eligibleRoles.length === 0) return false;
    const activeRoles = [actor.systemRole, ...actor.sectionAssignments.map((a) => a.role)]
        .filter((role): role is RoleRef => Boolean(role?.isActive));
    return activeRoles.some((role) => eligibleRoles.some((eligible) => {
        const code = role.code.replace(/_GLOBAL$/, '');
        return code === eligible || code.endsWith(`_${eligible}`);
    }));
}

export function mayActOnLevel(actor: GateActor, permissions: readonly string[], level: LevelRef, scope?: GateScope): boolean {
    if (!level.requiredPermission || !permissions.includes(level.requiredPermission)) return false;
    if (level.assignee === 'ORDER_CONTRACTOR') return !!scope?.contractorId && actor.contractorId === scope.contractorId;
    const isAdmin = permissions.includes(ADMIN_CAPABILITY);
    if (scope?.opmcId && !isAdmin && !(actor.accessibleOpmcIds ?? []).includes(scope.opmcId)) return false;
    if (isAdmin || (level.specificUserId && level.specificUserId === actor.id)) return true;
    return hasEligibleRole(actor, parseEligibleRoles(level.eligibleRoles));
}

/**
 * The first step at or after `from` that applies. A step flagged skipIfNoApprover is skipped when nobody holds it in the area
 * (`holderExists` answers that); every other step always applies. -1 means no step is left.
 */
export async function firstApplicableLevel<L extends { skipIfNoApprover?: boolean | null }>(
    levels: readonly L[],
    from: number,
    holderExists: (level: L) => Promise<boolean>,
): Promise<number> {
    for (let i = from; i < levels.length; i++) {
        if (!levels[i].skipIfNoApprover) return i;
        if (await holderExists(levels[i])) return i;
    }
    return -1;
}

/** Human name of a step: its description's first words are instructions, so the role code is what identifies it. */
const ROLE_LABEL: Record<string, string> = {
    AREA_COORDINATOR: 'Area Coordinator',
    QC_OFFICER: 'QC Officer',
    CONTRACTOR: 'Contractor',
    ENGINEER: 'Area Engineer / Officer',
    ASSISTANT_ENGINEER: 'Assistant Engineer',
    AREA_MANAGER: 'Area Manager (ARM)',
    OSP_MANAGER: 'OSP Manager',
    HEAD_OF_OSP: 'Head of OSP',
    FINANCE_MANAGER: 'Finance Manager',
};
export function roleLabel(role: string): string {
    return ROLE_LABEL[role] ?? role.toLowerCase().split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}
