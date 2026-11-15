import { prisma } from '@/lib/prisma';
import { AppError } from '@/lib/error';
import { AuditService } from '@/services/audit/audit.service';
import { SystemConfigService } from '@/services/core/system-config.service';
import { userHasPermission } from '@/lib/user-permissions';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { requiredTier, withinLimit, type ApprovalTiers } from '@/lib/procurement-rules';

/**
 * Amount-based approval for purchase orders. Limits come from the existing finance settings (manager / GM / director) and
 * a role's own `approvalLimit` when one is set; administrators have no ceiling. A purchase order above the manager limit
 * is raised as PENDING_APPROVAL and needs an approver whose limit covers it.
 */
export class ApprovalLimitService {
    static async tiers(): Promise<ApprovalTiers> {
        const c = await SystemConfigService.getFinanceConfig();
        return { manager: c.approvalLimitManager, gm: c.approvalLimitGM, director: c.approvalLimitDirector };
    }

    /** A user's approval ceiling: null = none (administrator), otherwise the role limit or the manager limit. */
    static async limitFor(userId: string): Promise<number | null> {
        if (await userHasPermission(userId, RBAC_PERMISSIONS.ADMIN_RBAC)) return null;
        const user = await prisma.user.findUnique({ where: { id: userId }, select: { systemRole: { select: { approvalLimit: true } } } });
        const roleLimit = user?.systemRole?.approvalLimit;
        if (roleLimit !== null && roleLimit !== undefined) return Number(roleLimit);
        return (await this.tiers()).manager;
    }

    /** Whether a new order of this value can be approved on creation (it is within the manager limit). */
    static async autoApproves(amount: number): Promise<boolean> {
        return amount <= (await this.tiers()).manager;
    }

    static async assertCanApprove(userId: string, amount: number, entity: string, entityId: string): Promise<void> {
        const limit = await this.limitFor(userId);
        if (withinLimit(amount, limit)) return;
        const tier = requiredTier(amount, await this.tiers());
        AuditService.log({ userId, action: 'APPROVAL_LIMIT_EXCEEDED', entity, entityId, newValue: { amount, limit, requiredTier: tier } }).catch(() => undefined);
        throw AppError.forbidden(`APPROVAL_LIMIT_EXCEEDED: this order (${Math.round(amount).toLocaleString('en-US')}) needs ${tier ?? 'a higher authority than any configured tier'}; your approval limit is ${Math.round(limit ?? 0).toLocaleString('en-US')}`);
    }
}
