/**
 * Centralized Table Column Registry
 * 
 * Single source of truth for all table column definitions across the ERP.
 * Used by:
 *  - /api/admin/table-settings (API route for saving/loading settings)
 *  - /admin/settings Tab 5 (Admin UI for configuring visibility)
 *  - useTableColumnSettings hook (Consumer hook for table pages)
 * 
 * HOW TO ADD A NEW COLUMN:
 *  1. Add entry to the relevant table's column array below
 *  2. Add the <th>/<td> in the table component with isColumnVisible() wrapper
 *  3. That's it - admin settings UI auto-picks up the new column
 * 
 * HOW TO ADD A NEW TABLE:
 *  1. Add a new key to TABLE_COLUMNS below
 *  2. Add a label to TABLE_LABELS
 *  3. Use useTableColumnSettings('table_key') in the table page
 * 
 * Column properties:
 *  - key: unique identifier (matches data field name)
 *  - label: display name shown in admin settings
 *  - required: if true, column cannot be hidden (default: false)
 */

export interface ColumnDefinition {
    key: string;
    label: string;
    required?: boolean;
}

export type TableColumnsMap = Record<string, ColumnDefinition[]>;

// ─────────────────────────────────────────────────────────
// COLUMN DEFINITIONS - All ERP tables
// ─────────────────────────────────────────────────────────

export const TABLE_COLUMNS: TableColumnsMap = {

    // ═══════════════════════════════════════════════════════
    // SERVICE ORDER (SOD) TABLES
    // ═══════════════════════════════════════════════════════

    pending_sod: [
        { key: 'soNum', label: 'SO Number', required: true },
        { key: 'customerName', label: 'Customer Details' },
        { key: 'voiceNumber', label: 'Voice Number' },
        { key: 'dp', label: 'DP' },
        { key: 'contractorId', label: 'Contractor' },
        { key: 'sltsStatus', label: 'Status' },
        { key: 'scheduledDate', label: 'Appointment' },
        { key: 'comments', label: 'Comments/Notes' },
        { key: 'actions', label: 'Actions', required: true },
    ],

    completed_sod: [
        { key: 'soNum', label: 'SO Number', required: true },
        { key: 'completedDate', label: 'Completed Date' },
        { key: 'customerName', label: 'Customer Details' },
        { key: 'voiceNumber', label: 'Voice Number' },
        { key: 'ontSerialNumber', label: 'ONT Serial' },
        { key: 'teamId', label: 'Contractor Team' },
        { key: 'status', label: 'Status' },
        { key: 'comments', label: 'Comments/Notes' },
        { key: 'revenue', label: 'Revenue' },
    ],

    return_sod: [
        { key: 'soNum', label: 'SO Number', required: true },
        { key: 'completedDate', label: 'Return Date' },
        { key: 'customerName', label: 'Customer Details' },
        { key: 'voiceNumber', label: 'Voice Number' },
        { key: 'contractorId', label: 'Contractor' },
        { key: 'sltsStatus', label: 'Status' },
        { key: 'returnReason', label: 'Return Reason' },
        { key: 'comments', label: 'Comments/Notes' },
        { key: 'actions', label: 'Actions', required: true },
    ],

    restore_request: [
        { key: 'soNum', label: 'SO Number', required: true },
        { key: 'requestedBy', label: 'Requested By' },
        { key: 'requestDate', label: 'Request Date' },
        { key: 'reason', label: 'Reason' },
        { key: 'status', label: 'Status' },
        { key: 'approvedBy', label: 'Approved By' },
        { key: 'actions', label: 'Actions', required: true },
    ],

    // ═══════════════════════════════════════════════════════
    // INVENTORY TABLES
    // ═══════════════════════════════════════════════════════

    inventory_stock: [
        { key: 'itemCode', label: 'Item Code', required: true },
        { key: 'itemName', label: 'Item Name', required: true },
        { key: 'unit', label: 'Unit' },
        { key: 'quantity', label: 'Quantity', required: true },
        { key: 'tracking', label: 'Tracking (Batches/Serials)' },
        { key: 'actions', label: 'Actions', required: true },
    ],

    inventory_issues: [
        { key: 'issueNumber', label: 'Issue No', required: true },
        { key: 'date', label: 'Date' },
        { key: 'type', label: 'Type' },
        { key: 'recipient', label: 'Recipient' },
        { key: 'items', label: 'Items Count' },
        { key: 'issuedBy', label: 'Issued By' },
        { key: 'actions', label: 'Actions', required: true },
    ],

    inventory_grn_pending: [
        { key: 'requestNo', label: 'Request No', required: true },
        { key: 'poNumber', label: 'PO Number' },
        { key: 'vendor', label: 'Vendor' },
        { key: 'items', label: 'Items Progress' },
        { key: 'expectedDelivery', label: 'Expected Delivery' },
        { key: 'actions', label: 'Actions', required: true },
    ],

    inventory_grn_completed: [
        { key: 'grnNumber', label: 'GRN No', required: true },
        { key: 'poNumber', label: 'PO Number' },
        { key: 'supplier', label: 'Supplier' },
        { key: 'items', label: 'Items Count' },
        { key: 'receivedDate', label: 'Received Date' },
        { key: 'actions', label: 'Actions', required: true },
    ],

    inventory_cardex: [
        { key: 'date', label: 'Date', required: true },
        { key: 'type', label: 'Transaction Type' },
        { key: 'reference', label: 'Reference / Details' },
        { key: 'store', label: 'Store' },
        { key: 'operator', label: 'Operator' },
        { key: 'quantity', label: 'Quantity', required: true },
    ],

    // ═══════════════════════════════════════════════════════
    // PROCUREMENT TABLES
    // ═══════════════════════════════════════════════════════

    procurement_orders: [
        { key: 'requestNr', label: 'Request No', required: true },
        { key: 'date', label: 'Date' },
        { key: 'source', label: 'Source' },
        { key: 'poNumber', label: 'PO Number' },
        { key: 'vendor', label: 'Vendor / Supplier' },
        { key: 'expectedDelivery', label: 'Expected Delivery' },
        { key: 'items', label: 'Items Count' },
        { key: 'status', label: 'Status' },
        { key: 'actions', label: 'Actions', required: true },
    ],

    procurement_forecast: [
        { key: 'itemDetails', label: 'Item Details', required: true },
        { key: 'currentStock', label: 'In Hand' },
        { key: 'avgMonthlyConsumption', label: 'Avg Monthly Consumption' },
        { key: 'targetDemand', label: 'Target Demand' },
        { key: 'predictedDemand', label: 'Total Horizon Req' },
        { key: 'shortfall', label: 'Predicted Shortfall' },
        { key: 'reorderQty', label: 'Reorder Qty (+10%)' },
        { key: 'unitPrice', label: 'Unit Price' },
        { key: 'projectedCost', label: 'Projected Cost' },
    ],

    procurement_expiry: [
        { key: 'batchNumber', label: 'Batch Number', required: true },
        { key: 'materialName', label: 'Material Name' },
        { key: 'storeLocation', label: 'Store Location' },
        { key: 'remainingQty', label: 'Remaining Quantity' },
        { key: 'expiryDate', label: 'Expiry Date' },
        { key: 'alertStatus', label: 'Alert Status' },
    ],

    // ═══════════════════════════════════════════════════════
    // ADMIN TABLES
    // ═══════════════════════════════════════════════════════

    admin_users: [
        { key: 'identity', label: 'User Identity', required: true },
        { key: 'role', label: 'Role & Department' },
        { key: 'store', label: 'Warehouse / Store' },
        { key: 'rtomScope', label: 'RTOM Scope' },
        { key: 'supervisor', label: 'Supervisor' },
        { key: 'actions', label: 'Actions', required: true },
    ],
};

// ─────────────────────────────────────────────────────────
// TABLE DISPLAY LABELS (for admin settings UI)
// ─────────────────────────────────────────────────────────

export const TABLE_LABELS: Record<string, string> = {
    // SOD
    'pending_sod': 'Pending Service Orders',
    'completed_sod': 'Completed Service Orders',
    'return_sod': 'Return Service Orders',
    'restore_request': 'Restore Requests',
    // Inventory
    'inventory_stock': 'Inventory - Stock List',
    'inventory_issues': 'Inventory - Stock Issues',
    'inventory_grn_pending': 'Inventory - Pending GRNs',
    'inventory_grn_completed': 'Inventory - Completed GRNs',
    'inventory_cardex': 'Inventory - Cardex Report',
    // Procurement
    'procurement_orders': 'Procurement - Purchase Orders',
    'procurement_forecast': 'Procurement - Material Forecast',
    'procurement_expiry': 'Procurement - Expiry Alerts',
    // Admin
    'admin_users': 'Administration - Users',
};

// ─────────────────────────────────────────────────────────
// TABLE GROUPS (for admin settings UI sections)
// ─────────────────────────────────────────────────────────

export const TABLE_GROUPS = {
    'Service Orders': ['pending_sod', 'completed_sod', 'return_sod', 'restore_request'],
    'Inventory': ['inventory_stock', 'inventory_issues', 'inventory_grn_pending', 'inventory_grn_completed', 'inventory_cardex'],
    'Procurement': ['procurement_orders', 'procurement_forecast', 'procurement_expiry'],
    'Administration': ['admin_users'],
};
