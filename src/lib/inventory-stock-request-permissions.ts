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
    // review: change the quantities before the approval. The Stores Executive holds this and not inventory.approve, so can neither approve nor reject.
    ADJUST_QTY: RBAC_PERMISSIONS.INVENTORY_REVIEW,
    RETURN: RBAC_PERMISSIONS.INVENTORY_APPROVE,
    // releasing stock from the main store: the Executive and the Manager (the officers raise requests and receive at their own store)
    RELEASE: RBAC_PERMISSIONS.INVENTORY_RELEASE,
    RECEIVE: RBAC_PERMISSIONS.INVENTORY_WRITE,
    // the Stores Manager confirms the request documents were handed to Procurement
    DOCS_SUBMITTED: RBAC_PERMISSIONS.INVENTORY_APPROVE,
    CREATE_PO: RBAC_PERMISSIONS.PROCUREMENT_WRITE,
    UPDATE_PROCUREMENT_STATUS: RBAC_PERMISSIONS.PROCUREMENT_WRITE,
    PROCUREMENT_COMPLETE: RBAC_PERMISSIONS.PROCUREMENT_WRITE,
};

export function getStockRequestActionPermission(action: string | undefined): RbacPermission | undefined {
    if (!action) return undefined;
    return STOCK_REQUEST_ACTION_PERMISSIONS[action as StockRequestAction];
}
