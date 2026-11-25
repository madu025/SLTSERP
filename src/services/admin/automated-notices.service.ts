import { prisma } from '@/lib/prisma';
import { AppError } from '@/lib/error';
import { AuditService } from '@/services/audit/audit.service';
import { NotificationService } from '@/services/notification';
import { NOTIFICATION_AUDIENCES, type NotificationAudienceId } from '@/services/notification/notification-audiences';
import { AUDIENCE_INFO, SCHEDULED_NOTICES } from '@/config/automated-notices';

export interface AudienceRole { id: string; code: string; name: string; holds: boolean; users: number }
export interface AudienceOverview {
    id: NotificationAudienceId;
    label: string;
    description: string;
    areaScope: string;
    permission: string;
    recipients: number;
    withEmail: number;
    byRole: Array<{ role: string; count: number }>;
    roles: AudienceRole[];
}

const isAudience = (id: string): id is NotificationAudienceId => Object.hasOwn(NOTIFICATION_AUDIENCES, id);

/**
 * What the system sends by itself, and to whom: the administrator's view of the notification audiences.
 * An audience is a capability (notification.audience.*) held by roles in the database; changing who is in it is granting or removing
 * that capability for a role. The seed leaves existing audience grants alone (src/lib/rbac-seed-rules.ts), so a change made here stays.
 */
export class AutomatedNoticesService {
    static async overview() {
        const roleRows = await prisma.systemRole.findMany({
            where: { isActive: true },
            select: { id: true, code: true, name: true, _count: { select: { users: true, userAssignments: true } }, rolePermissions: { where: { permission: { startsWith: 'notification.audience.' } }, select: { permission: true } } },
            orderBy: { code: 'asc' },
        });
        const audiences: AudienceOverview[] = [];
        for (const id of Object.keys(NOTIFICATION_AUDIENCES) as NotificationAudienceId[]) {
            const permission = NOTIFICATION_AUDIENCES[id].permission;
            const recipients = await NotificationService.getAudienceRecipients({ audience: id });
            const users = recipients.length ? await prisma.user.findMany({ where: { id: { in: recipients.map((r) => r.id) } }, select: { role: true } }) : [];
            const byRole = new Map<string, number>();
            users.forEach((u) => byRole.set(u.role, (byRole.get(u.role) ?? 0) + 1));
            const info = AUDIENCE_INFO[id];
            audiences.push({
                id, label: info.label, description: info.description, areaScope: info.areaScope, permission,
                recipients: recipients.length, withEmail: recipients.filter((r) => r.email).length,
                byRole: [...byRole.entries()].sort((a, b) => b[1] - a[1]).map(([role, count]) => ({ role, count })),
                // the roles the administrator can switch: those that hold the audience, or have people in them
                roles: roleRows
                    .map((r) => ({ id: r.id, code: r.code, name: r.name, users: r._count.users + r._count.userAssignments, holds: r.rolePermissions.some((p) => p.permission === permission) }))
                    .filter((r) => r.holds || r.users > 0),
            });
        }
        return { notices: SCHEDULED_NOTICES, audiences };
    }

    /** The people an audience reaches right now. */
    static async people(audienceId: string) {
        if (!isAudience(audienceId)) throw AppError.badRequest('UNKNOWN_AUDIENCE');
        const recipients = await NotificationService.getAudienceRecipients({ audience: audienceId });
        if (recipients.length === 0) return [];
        const users = await prisma.user.findMany({ where: { id: { in: recipients.map((r) => r.id) } }, select: { id: true, name: true, role: true, email: true }, orderBy: [{ role: 'asc' }, { name: 'asc' }] });
        return users;
    }

    /** Add a role to an audience, or take it out. Audited. */
    static async setRole(actorId: string, audienceId: string, roleId: string, grant: boolean) {
        if (!isAudience(audienceId)) throw AppError.badRequest('UNKNOWN_AUDIENCE');
        const permission = NOTIFICATION_AUDIENCES[audienceId].permission;
        const [role, definition] = await Promise.all([
            prisma.systemRole.findUnique({ where: { id: roleId }, select: { id: true, code: true, isActive: true } }),
            prisma.permissionDefinition.findUnique({ where: { code: permission }, select: { id: true, isActive: true } }),
        ]);
        if (!role || !role.isActive) throw AppError.notFound('ROLE_NOT_FOUND');
        if (!definition?.isActive) throw AppError.badRequest('AUDIENCE_NOT_AVAILABLE: the capability is not in the database yet (the RBAC seed has not run)');
        if (grant) {
            await prisma.rolePermission.upsert({
                where: { roleId_permission: { roleId: role.id, permission } },
                create: { roleId: role.id, permission, permissionDefinitionId: definition.id },
                update: { permissionDefinitionId: definition.id },
            });
        } else {
            await prisma.rolePermission.deleteMany({ where: { roleId: role.id, permission } });
        }
        await AuditService.log({ userId: actorId, action: grant ? 'NOTIFICATION_AUDIENCE_ROLE_ADDED' : 'NOTIFICATION_AUDIENCE_ROLE_REMOVED', entity: 'NotificationAudience', entityId: audienceId, newValue: { audience: audienceId, permission, role: role.code } }).catch(() => undefined);
        return { audience: audienceId, role: role.code, holds: grant };
    }
}
