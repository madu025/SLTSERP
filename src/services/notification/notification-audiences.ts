import { RBAC_PERMISSIONS, type RbacPermission } from '@/config/rbac-permissions';

/**
 * Canonical notification recipient audiences.
 *
 * An audience is a capability-backed recipient policy, not a display role.
 * RolePermission rows grant these capabilities during bootstrap, while
 * administrators can change the audience membership in the database without
 * changing notification callsites.
 */
export const NOTIFICATION_AUDIENCES = {
    ADMINISTRATORS: { permission: RBAC_PERMISSIONS.NOTIFICATION_ADMINISTRATORS },
    PROJECT_MANAGERS: { permission: RBAC_PERMISSIONS.NOTIFICATION_PROJECT_MANAGERS },
    STORES_MANAGERS: { permission: RBAC_PERMISSIONS.NOTIFICATION_STORES_MANAGERS },
    OFFICE_ADMINS: { permission: RBAC_PERMISSIONS.NOTIFICATION_OFFICE_ADMINS },
    OPERATIONS: { permission: RBAC_PERMISSIONS.NOTIFICATION_OPERATIONS },
    SOD_PROJECT: { permission: RBAC_PERMISSIONS.NOTIFICATION_SOD_PROJECT },
    FINANCE_APPROVERS: { permission: RBAC_PERMISSIONS.NOTIFICATION_FINANCE_APPROVERS },
    FINANCE_ALL: { permission: RBAC_PERMISSIONS.NOTIFICATION_FINANCE_ALL },
    INVENTORY_LOW_STOCK: { permission: RBAC_PERMISSIONS.NOTIFICATION_INVENTORY_LOW_STOCK },
    INVENTORY_ALERT_EMAIL: { permission: RBAC_PERMISSIONS.NOTIFICATION_INVENTORY_ALERT_EMAIL },
    STOCK_REQUEST_ARM: { permission: RBAC_PERMISSIONS.NOTIFICATION_STOCK_REQUEST_ARM },
    STOCK_REQUEST_PROCUREMENT: { permission: RBAC_PERMISSIONS.NOTIFICATION_STOCK_REQUEST_PROCUREMENT },
    HELPDESK_TICKET_MANAGERS: { permission: RBAC_PERMISSIONS.NOTIFICATION_HELPDESK_TICKET_MANAGERS },
    PROCESS_GATE_OSP_MANAGER: { permission: RBAC_PERMISSIONS.NOTIFICATION_PROCESS_GATE_OSP_MANAGER },
    PROCESS_GATE_HEAD_OF_SECTION: { permission: RBAC_PERMISSIONS.NOTIFICATION_PROCESS_GATE_HEAD_OF_SECTION },
    PROCESS_GATE_PROCUREMENT: { permission: RBAC_PERMISSIONS.NOTIFICATION_PROCESS_GATE_PROCUREMENT },
    PROCESS_GATE_STORES: { permission: RBAC_PERMISSIONS.NOTIFICATION_PROCESS_GATE_STORES },
} as const satisfies Record<string, { permission: RbacPermission }>;

export type NotificationAudienceId = keyof typeof NOTIFICATION_AUDIENCES;

/** Resolve the persisted canonical process-gate notification target. */
export function resolveProcessGateAudience(
    configured: string | null | undefined,
): NotificationAudienceId | null {
    if (typeof configured === 'string' && Object.hasOwn(NOTIFICATION_AUDIENCES, configured)) {
        return configured as NotificationAudienceId;
    }
    return null;
}
