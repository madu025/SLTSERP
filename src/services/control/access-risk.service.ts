import { prisma } from '@/lib/prisma';
import { deriveEffectivePermissions, parsePermissionList } from '@/lib/effective-permissions';
import { isCanonicalPermission } from '@/config/rbac-permissions';
import { DAY_MS, PASSWORD_MAX_AGE_DAYS, DORMANT_DAYS, activityState, findSodConflicts, isPrivileged, passwordAgeDays, type AccessRiskReport, type RiskUser } from '@/lib/control-shared';

const CAP = 100;

/**
 * Who can do what, and which accounts look risky: privileged accounts, manual permission overrides, standing
 * separation-of-duties conflicts, accounts with no scope or no permissions, dormant and never-used accounts, old passwords.
 *
 * Read only. Effective permissions are derived with the same function the sign-in uses, so this report can never
 * disagree with what a user can actually do. Staff accounts only: contractor portal users are excluded.
 */
export class AccessRiskService {
    static async getReport(now = new Date()): Promise<AccessRiskReport> {
        const users = await prisma.user.findMany({
            where: { status: { equals: 'active', mode: 'insensitive' }, contractorId: null },
            include: {
                accessibleOpmcs: { select: { id: true } },
                systemRole: { include: { rolePermissions: { include: { permissionDefinition: true } } } },
                sectionAssignments: { include: { role: { include: { rolePermissions: { include: { permissionDefinition: true } } } } } },
            },
        });

        const privileged: RiskUser[] = [], overrides: RiskUser[] = [], overridePrivileged: RiskUser[] = [], noPermissions: RiskUser[] = [], noScope: RiskUser[] = [];
        const sodConflicts: AccessRiskReport['sodConflicts'] = [], dormant: RiskUser[] = [], neverLoggedIn: RiskUser[] = [], oldPasswords: RiskUser[] = [];
        let inactiveRoleAssignments = 0;

        for (const u of users) {
            const perms = deriveEffectivePermissions(u);
            const base = { id: u.id, username: u.username, name: u.name };
            const priv = isPrivileged(perms);
            if (priv) privileged.push({ ...base, detail: perms.includes('admin.super') ? 'Super administrator' : 'Administrator (global scope)' });

            if (u.permissions !== null) {
                const granted = parsePermissionList(u.permissions);
                const unknown = granted.filter((c) => !isCanonicalPermission(c)).length;
                overrides.push({ ...base, detail: `${granted.length} granted directly${unknown ? `, ${unknown} unknown code(s)` : ''}` });
                if (priv || granted.includes('finance.approve') || granted.includes('project.finance.approve')) overridePrivileged.push({ ...base, detail: 'Holds approval or admin rights through a manual override' });
            }
            if (perms.length === 0) noPermissions.push({ ...base, detail: 'No effective permissions' });
            if (!priv && u.accessibleOpmcs.length === 0) noScope.push({ ...base, detail: 'No OPMC scope: sees nothing scoped' });

            // Administrators hold everything, so their conflicts are the standing exception already listed above
            const conflicts = priv ? [] : findSodConflicts(perms);
            if (conflicts.length > 0) sodConflicts.push({ ...base, detail: conflicts.map((c) => c.label).join('; '), conflicts: conflicts.map((c) => c.id) });

            const state = activityState(u.lastLoginAt, now);
            if (state === 'NEVER') neverLoggedIn.push({ ...base, detail: `Created ${u.createdAt.toISOString().slice(0, 10)}` });
            if (state === 'DORMANT') dormant.push({ ...base, detail: `Last sign-in ${u.lastLoginAt!.toISOString().slice(0, 10)}` });

            const age = passwordAgeDays(u.passwordChangedAt, now);
            if (age !== null && age > PASSWORD_MAX_AGE_DAYS) oldPasswords.push({ ...base, detail: `Password ${age} days old` });

            if (u.systemRole && u.systemRole.isActive === false) inactiveRoleAssignments++;
            inactiveRoleAssignments += u.sectionAssignments.filter((a) => a.role && a.role.isActive === false).length;
        }

        const since7 = new Date(now.getTime() - 7 * DAY_MS);
        const [failedTotal, failedBy, first] = await Promise.all([
            prisma.loginEvent.count({ where: { success: false, createdAt: { gte: since7 } } }),
            prisma.loginEvent.groupBy({ by: ['username'], where: { success: false, createdAt: { gte: since7 } }, _count: { _all: true }, orderBy: { _count: { username: 'desc' } }, take: 5 }),
            prisma.loginEvent.aggregate({ _min: { createdAt: true } }),
        ]);

        const cap = <T,>(rows: T[]) => rows.slice(0, CAP);
        return {
            asOf: now.toISOString(),
            activeUsers: users.length,
            privileged: cap(privileged), overrides: cap(overrides), overridePrivileged: cap(overridePrivileged), noPermissions: cap(noPermissions), noScope: cap(noScope),
            sodConflicts: cap(sodConflicts), dormant: cap(dormant), neverLoggedIn: cap(neverLoggedIn), oldPasswords: cap(oldPasswords),
            inactiveRoleAssignments,
            failedLogins7d: { total: failedTotal, byUser: failedBy.map((f) => ({ username: f.username, count: f._count._all })) },
            trackingSince: first._min.createdAt ? first._min.createdAt.toISOString() : null,
            notes: [
                `Dormant = no sign-in for ${DORMANT_DAYS} days; "never" means no sign-in recorded since tracking started${first._min.createdAt ? ` (${first._min.createdAt.toISOString().slice(0, 10)})` : ' (no sign-ins recorded yet)'}.`,
                `Old password = changed more than ${PASSWORD_MAX_AGE_DAYS} days ago; accounts whose change was never recorded are not listed.`,
                'Administrators are exempt from most maker-checker rules, so every one of them is listed as a standing exception.',
                `Lists show the first ${CAP} accounts; counts above are totals for the list shown.`,
            ],
        };
    }
}
