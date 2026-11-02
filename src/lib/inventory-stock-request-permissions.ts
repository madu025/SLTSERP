import { RBAC_PERMISSIONS, type RbacPermission } from '@/config/rbac-permissions';
import type { StockRequestActionData } from '@/types/inventory/inventory-service.types';

export type StockRequestAction = StockRequestActionData['action'];

/**
 * Stock-request actions are deliberately mapped to capabilities rather than
 * legacy display roles. Store scope is enforced separately by the service.
 */
export const STOCK_REQUEST_ACTION_PERMISSIONS: Readonly<Record<StockRequestAction, RbacPermission>> = {
    ARM_APPROVE: RBAC_PERMISSIONS.INVENTORY_APPROVE,
    STORES_MANAGER_APPROVE: RBAC_PERMISSIONS.INVENTORY_APPROVE,
    APPROVE: RBAC_PERMISSIONS.INVENTORY_APPROVE,
    GATE_PASSED: RBAC_PERMISSIONS.INVENTORY_APPROVE,
    REJECT: RBAC_PERMISSIONS.INVENTORY_APPROVE,
    RECALL_APPROVAL: RBAC_PERMISSIONS.INVENTORY_APPROVE,
    RETURN: RBAC_PERMISSIONS.INVENTORY_APPROVE,
    RELEASE: RBAC_PERMISSIONS.INVENTORY_WRITE,
    RECEIVE: RBAC_PERMISSIONS.INVENTORY_WRITE,
    CREATE_PO: RBAC_PERMISSIONS.PROCUREMENT_WRITE,
    UPDATE_PROCUREMENT_STATUS: RBAC_PERMISSIONS.PROCUREMENT_WRITE,
    PROCUREMENT_COMPLETE: RBAC_PERMISSIONS.PROCUREMENT_WRITE,
};

export function getStockRequestActionPermission(action: string | undefined): RbacPermission | undefined {
    if (!action) return undefined;
    return STOCK_REQUEST_ACTION_PERMISSIONS[action as StockRequestAction];
}
