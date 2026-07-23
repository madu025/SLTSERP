import React from 'react';
import {
    Activity,
    LayoutDashboard,
    FileText,
    Users,
    HardHat,
    Settings,
    Building2,
    UserCog,
    Receipt,
    Warehouse,
    ClipboardCheck,
    ShoppingCart,
    FileSignature,
    FileCheck2,
    CheckCircle2,
    PackageMinus,
    Shield,
    ShieldCheck,
    FolderKanban,
    Upload,
    History as HistoryIcon,
    Terminal,
    RefreshCw,
    Car,
    Route,
    Banknote,
    BarChart3,
    List,
    BarChart2,
    LineChart,
    Truck,
    ClipboardList,
    Building,
    Landmark,
    ShieldAlert,
    LifeBuoy,
    Laptop,
    Calculator,
    TrendingUp,
    PieChart,
    Scale,
    FileSpreadsheet,
    Layers,
    Package,
    Lock
} from 'lucide-react';


// Define Role Groups based on Department Categories
export const ROLE_GROUPS = {
    // Super Users
    ADMINS: ['SUPER_ADMIN', 'ADMIN'],

    // 1. OSP Projects (Engineers, Coordinators)
    OSP_PROJECTS: ['SUPER_ADMIN', 'ADMIN', 'OSP_MANAGER', 'AREA_MANAGER', 'ENGINEER', 'ASSISTANT_ENGINEER', 'AREA_COORDINATOR', 'QC_OFFICER'],

    // 2. New Connections (Service Provisioning)
    NEW_CONNECTION: ['SUPER_ADMIN', 'ADMIN', 'MANAGER'],

    // 3. Service Assurance (Faults/Maintenance)
    SERVICE_ASSURANCE: ['SUPER_ADMIN', 'ADMIN', 'SA_MANAGER', 'SA_ASSISTANT'],

    // 4. Stores / Inventory
    STORES: ['SUPER_ADMIN', 'ADMIN', 'STORES_MANAGER', 'STORES_ASSISTANT'],

    // 5. Procurement
    PROCUREMENT: ['SUPER_ADMIN', 'ADMIN', 'PROCUREMENT_OFFICER'],

    // 6. Finance
    FINANCE: ['SUPER_ADMIN', 'ADMIN', 'FINANCE_MANAGER', 'FINANCE_ASSISTANT'],

    // 7. Invoice
    INVOICE: ['SUPER_ADMIN', 'ADMIN', 'INVOICE_MANAGER', 'INVOICE_ASSISTANT'],

    // 8. Office Admin (Staff/HR)
    OFFICE_ADMINS: ['SUPER_ADMIN', 'ADMIN', 'OFFICE_ADMIN', 'OFFICE_ADMIN_ASSISTANT', 'SITE_OFFICE_STAFF'],

    // Combined Groups for Shared Access
    // Ops Team = OSP Projects + New Connection + Service Assurance
    ALL_OPS: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'OSP_MANAGER', 'AREA_MANAGER', 'ENGINEER', 'ASSISTANT_ENGINEER', 'AREA_COORDINATOR', 'QC_OFFICER', 'SA_MANAGER', 'SA_ASSISTANT']
};

export interface MenuItem {
    title: string;
    path: string;
    icon: React.ComponentType<{ className?: string }>;
    allowedRoles: string[]; // List of roles allowed to see this item
    permissionId?: string; // Dynamic permission ID
    submenu?: MenuItem[];
}

export const SIDEBAR_MENU: MenuItem[] = [
    {
        title: 'Dashboard',
        path: '/dashboard',
        icon: LayoutDashboard,
        allowedRoles: ['ALL'], // Special keyword for public/all access
        permissionId: 'dashboard'
    },
    {
        title: 'Service Orders',
        path: '/service-orders',
        icon: FileText,
        // Service Orders are main work for New Connection & Ops
        allowedRoles: ROLE_GROUPS.ALL_OPS,
        permissionId: 'service-orders',
        submenu: [
            {
                title: 'Pending SOD',
                path: '/service-orders',
                icon: FileText,
                allowedRoles: ROLE_GROUPS.ALL_OPS
            },
            {
                title: 'Install Closed SOD',
                path: '/service-orders/install-closed',
                icon: CheckCircle2,
                allowedRoles: ROLE_GROUPS.ALL_OPS
            },
            {
                title: 'Return SOD',
                path: '/service-orders/return',
                icon: FileText,
                allowedRoles: ROLE_GROUPS.ALL_OPS
            },
            {
                title: 'Completed SOD',
                path: '/service-orders/completed',
                icon: FileCheck2,
                allowedRoles: ROLE_GROUPS.ALL_OPS
            },
            {
                title: 'Invoicable SODs',
                path: '/service-orders/invoicable',
                icon: Receipt,
                allowedRoles: ROLE_GROUPS.ALL_OPS
            },
            {
                title: 'PAT Status Monitor',
                path: '/service-orders/pat',
                icon: ClipboardCheck,
                allowedRoles: ROLE_GROUPS.ALL_OPS
            }
        ]
    },
    {
        title: 'Contractors',
        path: '/admin/contractors',
        icon: HardHat,
        allowedRoles: [...ROLE_GROUPS.OSP_PROJECTS, ...ROLE_GROUPS.NEW_CONNECTION, ...ROLE_GROUPS.OFFICE_ADMINS],
        permissionId: 'contractors',
        submenu: [
            {
                title: 'All Contractors',
                path: '/admin/contractors',
                icon: HardHat,
                allowedRoles: [...ROLE_GROUPS.OSP_PROJECTS, ...ROLE_GROUPS.NEW_CONNECTION, ...ROLE_GROUPS.OFFICE_ADMINS]
            },
            {
                title: 'Bulk Import',
                path: '/admin/contractors/import',
                icon: Upload,
                allowedRoles: ROLE_GROUPS.ADMINS
            }
        ]
    },
    {
        title: 'Projects',
        path: '/projects',
        icon: FolderKanban,
        allowedRoles: [...ROLE_GROUPS.ADMINS, ...ROLE_GROUPS.OSP_PROJECTS],
        permissionId: 'service-orders',
        submenu: [
            {
                title: 'All Projects',
                path: '/projects',
                icon: List,
                allowedRoles: [...ROLE_GROUPS.ADMINS, ...ROLE_GROUPS.OSP_PROJECTS]
            },
            {
                title: 'PM Dashboard',
                path: '/projects/dashboards/pm',
                icon: BarChart2,
                allowedRoles: [...ROLE_GROUPS.ADMINS, ...ROLE_GROUPS.OSP_PROJECTS]
            },
            {
                title: 'Finance Dashboard',
                path: '/projects/dashboards/financials',
                icon: LineChart,
                allowedRoles: [...ROLE_GROUPS.ADMINS, 'OSP_MANAGER', 'AREA_MANAGER']
            },
            {
                title: 'QA/QC Dashboard',
                path: '/projects/dashboards/qaqc',
                icon: ClipboardList,
                allowedRoles: [...ROLE_GROUPS.ADMINS, ...ROLE_GROUPS.OSP_PROJECTS]
            },
            {
                title: 'Logistics Dashboard',
                path: '/projects/dashboards/logistics',
                icon: Truck,
                allowedRoles: [...ROLE_GROUPS.ADMINS, 'OSP_MANAGER', 'AREA_MANAGER', 'ENGINEER']
            },
            {
                title: 'IR Material Audit',
                path: '/projects/dashboards/ir-audit',
                icon: FileText,
                allowedRoles: [...ROLE_GROUPS.ADMINS, 'OSP_MANAGER', 'AREA_MANAGER', 'ENGINEER']
            },
            {
                title: 'National GIS Map',
                path: '/gis/map',
                icon: Route,
                allowedRoles: [...ROLE_GROUPS.ADMINS, ...ROLE_GROUPS.OSP_PROJECTS]
            },
            {
                title: 'GIS File Import',
                path: '/gis/upload',
                icon: Upload,
                allowedRoles: [...ROLE_GROUPS.ADMINS, ...ROLE_GROUPS.OSP_PROJECTS]
            },
        ]
    },

    {
        title: 'Finance & Accounts',
        path: '/admin/finance',
        icon: Banknote,
        allowedRoles: [...ROLE_GROUPS.ADMINS, ...ROLE_GROUPS.FINANCE, ...ROLE_GROUPS.OFFICE_ADMINS, 'OSP_MANAGER'],
        permissionId: 'invoices',
        submenu: [
            {
                title: 'SLT SLA Agreements',
                path: '/finance/slt-contracts',
                icon: FileCheck2,
                allowedRoles: [...ROLE_GROUPS.ADMINS, ...ROLE_GROUPS.FINANCE, 'OSP_MANAGER', 'MANAGER']
            },
            {
                title: 'Vendor Registry',
                path: '/admin/finance/vendors',
                icon: Building,
                allowedRoles: [...ROLE_GROUPS.ADMINS, ...ROLE_GROUPS.FINANCE]
            },
            {
                title: 'Bank Registry',
                path: '/admin/finance/banks',
                icon: Landmark,
                allowedRoles: [...ROLE_GROUPS.ADMINS, ...ROLE_GROUPS.FINANCE]
            },
            {
                title: 'Payment Vouchers',
                path: '/admin/finance/payments',
                icon: Receipt,
                allowedRoles: [...ROLE_GROUPS.ADMINS, ...ROLE_GROUPS.FINANCE]
            },
            {
                title: 'Petty Cash',
                path: '/admin/finance/petty-cash',
                icon: Banknote,
                allowedRoles: [...ROLE_GROUPS.ADMINS, ...ROLE_GROUPS.FINANCE, ...ROLE_GROUPS.OFFICE_ADMINS]
            },
            {
                title: 'Retention Management',
                path: '/admin/finance/retention',
                icon: Shield,
                allowedRoles: [...ROLE_GROUPS.ADMINS, ...ROLE_GROUPS.FINANCE]
            },
            {
                title: 'LD Penalties',
                path: '/admin/finance/ld-penalties',
                icon: ShieldAlert,
                allowedRoles: [...ROLE_GROUPS.ADMINS, ...ROLE_GROUPS.FINANCE]
            },
            {
                title: 'Rate Matrix Config',
                path: '/admin/finance/rate-matrix',
                icon: Calculator,
                allowedRoles: [...ROLE_GROUPS.ADMINS, ...ROLE_GROUPS.FINANCE, 'OSP_MANAGER']
            },
            {
                title: 'CAPEX / OPEX Dashboard',
                path: '/admin/finance/capex-opex',
                icon: TrendingUp,
                allowedRoles: [...ROLE_GROUPS.ADMINS, ...ROLE_GROUPS.FINANCE, 'OSP_MANAGER', 'AREA_MANAGER']
            },
            {
                title: 'Budget Allocations',
                path: '/admin/finance/budget',
                icon: PieChart,
                allowedRoles: [...ROLE_GROUPS.ADMINS, ...ROLE_GROUPS.FINANCE]
            },
            {
                title: 'Vendor Upload (HO)',
                path: '/admin/finance/vendors/import',
                icon: Upload,
                allowedRoles: ROLE_GROUPS.ADMINS
            },
            {
                title: 'Bank Upload (HO)',
                path: '/admin/finance/banks/import',
                icon: Upload,
                allowedRoles: ROLE_GROUPS.ADMINS
            }
        ]
    },

    {
        title: 'SF Audit Division',
        path: '/sf-audit/governance',
        icon: ShieldCheck,
        allowedRoles: [...ROLE_GROUPS.ADMINS, ...ROLE_GROUPS.FINANCE, ...ROLE_GROUPS.ALL_OPS, 'SF_AUDIT', 'SF_AUDIT_OFFICER', 'SF_AUDIT_MANAGER', 'AUDITOR'],
        permissionId: 'sf-audit',
        submenu: [
            {
                title: 'SF Audit Governance',
                path: '/sf-audit/governance',
                icon: ShieldCheck,
                allowedRoles: [...ROLE_GROUPS.ADMINS, ...ROLE_GROUPS.FINANCE, 'SF_AUDIT', 'SF_AUDIT_OFFICER', 'SF_AUDIT_MANAGER', 'AUDITOR']
            },
            {
                title: 'Contractor Invoice Pricing Audit',
                path: '/sf-audit/pricing-audit',
                icon: Calculator,
                allowedRoles: [...ROLE_GROUPS.ADMINS, ...ROLE_GROUPS.FINANCE, 'SF_AUDIT', 'SF_AUDIT_OFFICER', 'SF_AUDIT_MANAGER', 'AUDITOR']
            },
            {
                title: 'Header & Material Mapping Config',
                path: '/sf-audit/header-mapping',
                icon: Settings,
                allowedRoles: [...ROLE_GROUPS.ADMINS, ...ROLE_GROUPS.FINANCE, ...ROLE_GROUPS.ALL_OPS, 'SF_AUDIT', 'SF_AUDIT_OFFICER', 'SF_AUDIT_MANAGER', 'AUDITOR']
            },
            {
                title: 'Payment Split Rules Configurator',
                path: '/sf-audit/payment-split-config',
                icon: Calculator,
                allowedRoles: [...ROLE_GROUPS.ADMINS, ...ROLE_GROUPS.FINANCE, ...ROLE_GROUPS.ALL_OPS, 'SF_AUDIT', 'SF_AUDIT_OFFICER', 'SF_AUDIT_MANAGER', 'AUDITOR']
            }
        ]
    },

    {
        title: 'Billing & Invoices',
        path: '/invoices',
        icon: Receipt,
        allowedRoles: [...ROLE_GROUPS.ADMINS, ...ROLE_GROUPS.INVOICE, ...ROLE_GROUPS.FINANCE, 'MANAGER', 'OSP_MANAGER', 'AREA_MANAGER'],
        permissionId: 'invoices',
        submenu: [
            {
                title: 'Submit Invoices (SLT)',
                path: '/invoices',
                icon: Receipt,
                allowedRoles: [
                    ...ROLE_GROUPS.ADMINS,
                    ...ROLE_GROUPS.INVOICE,
                    ...ROLE_GROUPS.FINANCE,
                    'MANAGER', 'OSP_MANAGER', 'AREA_MANAGER'
                ]
            },
            {
                title: 'BOM Sheets (Imports)',
                path: '/invoices/bom-sheets',
                icon: Upload,
                allowedRoles: [
                    ...ROLE_GROUPS.ADMINS,
                    ...ROLE_GROUPS.INVOICE,
                    ...ROLE_GROUPS.FINANCE,
                    'MANAGER', 'OSP_MANAGER'
                ]
            },
            {
                title: 'Cost Allocation',
                path: '/admin/finance/cost-allocation',
                icon: FileSignature,
                allowedRoles: [...ROLE_GROUPS.ADMINS, ...ROLE_GROUPS.FINANCE, 'OSP_MANAGER']
            },
            {
                title: 'SOD Revenue Config',
                path: '/admin/sod-revenue',
                icon: Receipt,
                allowedRoles: ROLE_GROUPS.ADMINS
            }
        ]
    },

    {
        title: 'Inventory / Stores',
        path: '/inventory',
        icon: Warehouse,
        allowedRoles: ROLE_GROUPS.STORES,
        permissionId: 'inventory',
        submenu: [
            // 1. Setup & Master Data
            {
                title: 'Material Registration',
                path: '/inventory/items',
                icon: FileText,
                allowedRoles: ['SUPER_ADMIN', 'ADMIN', 'STORES_MANAGER']
            },
            {
                title: 'Bulk Import Materials',
                path: '/inventory/items/import',
                icon: Upload,
                allowedRoles: ['SUPER_ADMIN', 'ADMIN']
            },
            {
                title: 'Initial Stock Setup',
                path: '/admin/inventory/initial',
                icon: Warehouse,
                allowedRoles: ['SUPER_ADMIN', 'ADMIN', 'STORES_MANAGER']
            },
            {
                title: 'Pre-ERP Reconciliation',
                path: '/admin/inventory/pre-erp-reconciliation',
                icon: Scale,
                allowedRoles: ['SUPER_ADMIN', 'ADMIN', 'STORES_MANAGER', 'STORES_ASSISTANT', 'FINANCE_MANAGER']
            },
            {
                title: 'Material Audit Report',
                path: '/admin/inventory/material-audit-report',
                icon: FileSpreadsheet,
                allowedRoles: ['SUPER_ADMIN', 'ADMIN', 'STORES_MANAGER', 'FINANCE_MANAGER']
            },
            // 2. Stock Inflow
            {
                title: 'GRN Entry',
                path: '/inventory/grn',
                icon: Receipt,
                allowedRoles: ['SUPER_ADMIN', 'ADMIN', 'STORES_MANAGER']
            },
            {
                // Merged: Stock Requests + Material Request + My Requests → single hub
                title: 'Material Requests',
                path: '/inventory/requests',
                icon: ClipboardList,
                allowedRoles: ['SUPER_ADMIN', 'ADMIN', 'STORES_MANAGER', 'STORES_ASSISTANT', 'OSP_MANAGER']
            },
            {
                title: 'Material Approvals',
                path: '/inventory/approvals',
                icon: ClipboardCheck,
                allowedRoles: ['SUPER_ADMIN', 'ADMIN', 'STORES_MANAGER', 'OSP_MANAGER', 'AREA_MANAGER']
            },
            // 3. Stock Outflow
            {
                title: 'Stock Levels',
                path: '/inventory/stock',
                icon: BarChart3,
                allowedRoles: ROLE_GROUPS.STORES
            },
            {
                title: 'Stock Issue',
                path: '/inventory/issues',
                icon: PackageMinus,
                allowedRoles: ['SUPER_ADMIN', 'ADMIN', 'STORES_MANAGER', 'STORES_ASSISTANT']
            },
            {
                title: 'Asset Custody',
                path: '/inventory/assets',
                icon: HardHat,
                allowedRoles: ['SUPER_ADMIN', 'ADMIN', 'STORES_MANAGER']
            },
            {
                title: 'Wastage Reports',
                path: '/admin/inventory/wastage',
                icon: ClipboardCheck,   // was PackageMinus — conflicted with Stock Issue
                allowedRoles: ['SUPER_ADMIN', 'ADMIN', 'STORES_MANAGER', 'OSP_MANAGER']
            },
            // 4. Returns & Reconciliation
            {
                title: 'MRN (Material Return)',
                path: '/admin/inventory/mrns',
                icon: RefreshCw,        // was Receipt — conflicted with GRN
                allowedRoles: ['SUPER_ADMIN', 'ADMIN', 'STORES_MANAGER', 'STORES_ASSISTANT']
            },
            {
                title: 'Material Reconciliation',
                path: '/admin/inventory/reconciliation',
                icon: ClipboardCheck,
                allowedRoles: ROLE_GROUPS.STORES
            },
            {
                title: 'Contractor Balance Sheet',
                path: '/contractors/balance-sheet',
                icon: FileText,
                allowedRoles: ['SUPER_ADMIN', 'ADMIN', 'STORES_MANAGER', 'STORES_ASSISTANT']
            },
            {
                title: 'Virtual Transition',
                path: '/admin/inventory/virtual-swap',
                icon: RefreshCw,
                allowedRoles: ROLE_GROUPS.STORES
            },
            // 5. Analytics & History
            {
                title: 'Inventory Audit & Compliance',
                path: '/inventory/audit',
                icon: ShieldCheck,
                allowedRoles: ['SUPER_ADMIN', 'ADMIN', 'STORES_MANAGER', 'OSP_MANAGER']
            },
            {
                title: 'Inventory Cardex',
                path: '/inventory/reports/cardex',
                icon: HistoryIcon,      // was FileText — conflicted with Material Registration
                allowedRoles: ['SUPER_ADMIN', 'ADMIN', 'STORES_MANAGER', 'STORES_ASSISTANT']
            },
            {
                title: 'Inventory Dashboard',
                path: '/inventory/dashboard',   // was /inventory — same as parent, caused active-state conflict
                icon: LayoutDashboard,
                allowedRoles: ROLE_GROUPS.STORES
            }
        ]
    },
    {
        title: 'Approvals',
        path: '/procurement/approvals',
        icon: FileSignature,
        allowedRoles: ['SUPER_ADMIN', 'ADMIN', 'OSP_MANAGER', 'MANAGER', ...ROLE_GROUPS.ALL_OPS],
        permissionId: 'restore_requests',
        submenu: [
            {
                title: 'Procurement Approvals',
                path: '/procurement/approvals',
                icon: FileSignature,
                allowedRoles: ['SUPER_ADMIN', 'ADMIN', 'OSP_MANAGER', 'MANAGER']
            },
            {
                title: 'Contractor Registration Approvals',
                path: '/admin/contractors/approvals',
                icon: FileSignature,
                allowedRoles: ROLE_GROUPS.ALL_OPS
            }
        ]
    },
    {
        title: 'Procurement',
        path: '/procurement',
        icon: ShoppingCart,
        allowedRoles: [...ROLE_GROUPS.PROCUREMENT, ...ROLE_GROUPS.STORES],
        permissionId: 'procurement',
        submenu: [
            {
                title: 'Overview',
                path: '/procurement',
                icon: LayoutDashboard,
                allowedRoles: [...ROLE_GROUPS.PROCUREMENT, ...ROLE_GROUPS.STORES]
            },
            {
                title: 'Purchase Orders',
                path: '/procurement/orders',
                icon: FileText,
                allowedRoles: [...ROLE_GROUPS.PROCUREMENT, ...ROLE_GROUPS.STORES]
            },
            {
                title: 'AI Forecast & PO Builder',
                path: '/procurement/forecast',
                icon: FileText,
                allowedRoles: [...ROLE_GROUPS.PROCUREMENT, ...ROLE_GROUPS.STORES]
            }
        ]
    },
    {
        title: 'Finance & Accounts',
        path: '/admin/finance/chart-of-accounts',
        icon: Landmark,
        allowedRoles: ROLE_GROUPS.FINANCE,
        permissionId: 'finance',
        submenu: [
            {
                title: 'Chart of Accounts',
                path: '/admin/finance/chart-of-accounts',
                icon: List,
                allowedRoles: ROLE_GROUPS.FINANCE
            },
            {
                title: 'Trial Balance',
                path: '/admin/finance/reports/trial-balance',
                icon: Scale,
                allowedRoles: ROLE_GROUPS.FINANCE
            },
            {
                title: 'Profit & Loss Statement',
                path: '/admin/finance/reports/pnl',
                icon: TrendingUp,
                allowedRoles: ROLE_GROUPS.FINANCE
            },
            {
                title: 'Balance Sheet',
                path: '/admin/finance/reports/balance-sheet',
                icon: Landmark,
                allowedRoles: ROLE_GROUPS.FINANCE
            },
            {
                title: 'GL Ledger Viewer',
                path: '/admin/finance/reports/gl-viewer',
                icon: Layers,
                allowedRoles: ROLE_GROUPS.FINANCE
            },
            {
                title: 'VAT Return & Tax Register',
                path: '/admin/finance/tax/vat-return',
                icon: Receipt,
                allowedRoles: ROLE_GROUPS.FINANCE
            },
            {
                title: 'WHT Certificates & Register',
                path: '/admin/finance/tax/wht-register',
                icon: FileCheck2,
                allowedRoles: ROLE_GROUPS.FINANCE
            },
            {
                title: 'AR Aging & Collections',
                path: '/admin/finance/ar/aging',
                icon: Users,
                allowedRoles: ROLE_GROUPS.FINANCE
            },
            {
                title: 'AP Aging & Payables',
                path: '/admin/finance/ap/aging',
                icon: Building2,
                allowedRoles: ROLE_GROUPS.FINANCE
            },
            {
                title: 'Cash Book & Bank Ledger',
                path: '/admin/finance/bank/cash-book',
                icon: Landmark,
                allowedRoles: ROLE_GROUPS.FINANCE
            },
            {
                title: 'Bank Statement Reconciliation',
                path: '/admin/finance/bank/reconciliation',
                icon: CheckCircle2,
                allowedRoles: ROLE_GROUPS.FINANCE
            },
            {
                title: 'Fixed Asset Register & Depreciation',
                path: '/admin/finance/fixed-assets',
                icon: Package,
                allowedRoles: ROLE_GROUPS.FINANCE
            },
            {
                title: 'HO Payroll Expense Allocation',
                path: '/admin/finance/payroll',
                icon: Users,
                allowedRoles: ROLE_GROUPS.FINANCE
            },
            {
                title: 'Financial Period Close & Year-End',
                path: '/admin/finance/period-close',
                icon: Lock,
                allowedRoles: ROLE_GROUPS.FINANCE
            },
            {
                title: 'Credit & Debit Notes',
                path: '/admin/finance/credit-notes',
                icon: FileText,
                allowedRoles: ROLE_GROUPS.FINANCE
            }
        ]
    },

    {
        title: 'Reports & Analytics',
        path: '/reports',
        icon: FileText,
        allowedRoles: ['ALL'], // Open to all, but submenus are restricted
        submenu: [
            {
                title: 'Executive Overview',
                path: '/reports/manager',
                icon: LayoutDashboard,
                allowedRoles: ['SUPER_ADMIN', 'ADMIN', 'OSP_MANAGER', 'MANAGER']
            },
            {
                title: 'Area Performance',
                path: '/reports/arm',
                icon: Building2,
                allowedRoles: ['SUPER_ADMIN', 'ADMIN', 'OSP_MANAGER', 'MANAGER', 'AREA_MANAGER']
            },
            {
                title: 'Operational Reports',
                path: '/reports/user',
                icon: ClipboardCheck,
                allowedRoles: ['ALL']
            },
            {
                title: 'Daily Operational',
                path: '/reports/daily-operational',
                icon: FileText,
                allowedRoles: ['SUPER_ADMIN', 'ADMIN', 'OSP_MANAGER', 'MANAGER', 'AREA_MANAGER']
            }
        ]
    },
    {
        title: 'IT Help Desk',
        path: '/helpdesk',
        icon: LifeBuoy,
        allowedRoles: ['ALL'],
        submenu: [
            {
                title: 'User Dashboard',
                path: '/helpdesk',
                icon: LayoutDashboard,
                allowedRoles: ['ALL']
            },
            {
                title: 'Create Ticket',
                path: '/helpdesk/tickets/new',
                icon: FileText,
                allowedRoles: ['ALL']
            },
            {
                title: 'IT Dashboard (Staff)',
                path: '/helpdesk/admin',
                icon: Shield,
                allowedRoles: [...ROLE_GROUPS.ADMINS, 'OFFICE_ADMIN']
            },
            {
                title: 'Asset Management',
                path: '/helpdesk/assets',
                icon: Laptop,
                allowedRoles: [...ROLE_GROUPS.ADMINS, 'OFFICE_ADMIN']
            },
            {
                title: 'Device Audits',
                path: '/helpdesk/assets/audits',
                icon: ClipboardCheck,
                allowedRoles: [...ROLE_GROUPS.ADMINS, 'OFFICE_ADMIN']
            },
            {
                title: 'Software Licenses',
                path: '/helpdesk/software-licenses',
                icon: FileText,
                allowedRoles: [...ROLE_GROUPS.ADMINS, 'OFFICE_ADMIN']
            },
            {
                title: 'Help Desk Reports',
                path: '/helpdesk/reports',
                icon: BarChart3,
                allowedRoles: [...ROLE_GROUPS.ADMINS, 'OFFICE_ADMIN']
            }
        ]
    },
    {
        title: 'Vehicle & Fleet Management',
        path: '/vehicles',
        icon: Car,
        allowedRoles: [...ROLE_GROUPS.ADMINS, 'OFFICE_ADMIN', 'OFFICE_ADMIN_ASSISTANT'],
        permissionId: 'administration',
        submenu: [
            {
                title: 'All Vehicles',
                path: '/vehicles',
                icon: Car,
                allowedRoles: [...ROLE_GROUPS.ADMINS, 'OFFICE_ADMIN', 'OFFICE_ADMIN_ASSISTANT']
            },
            {
                title: 'Drivers Directory',
                path: '/drivers',
                icon: Users,
                allowedRoles: [...ROLE_GROUPS.ADMINS, 'OFFICE_ADMIN', 'OFFICE_ADMIN_ASSISTANT']
            },
            {
                title: 'Fleet Payments',
                path: '/payments',
                icon: Banknote,
                allowedRoles: [...ROLE_GROUPS.ADMINS, 'OFFICE_ADMIN', 'OFFICE_ADMIN_ASSISTANT']
            },
            {
                title: 'Fleet Reports',
                path: '/reports/fleet',
                icon: BarChart3,
                allowedRoles: [...ROLE_GROUPS.ADMINS, 'OFFICE_ADMIN', 'OFFICE_ADMIN_ASSISTANT']
            }
        ]
    },
    {
        title: 'Administration',
        path: '/admin',
        icon: UserCog,
        allowedRoles: [...ROLE_GROUPS.ADMINS, ...ROLE_GROUPS.OFFICE_ADMINS],
        permissionId: 'administration',
        submenu: [
            {
                title: 'User Management',
                path: '/admin/users',
                icon: Users,
                allowedRoles: ROLE_GROUPS.ADMINS
            },
            {
                title: 'Bulk User Import',
                path: '/admin/users/import',
                icon: Upload,
                allowedRoles: ROLE_GROUPS.ADMINS
            },
            {
                title: 'User Permissions',
                path: '/admin/user-permissions',
                icon: Shield,
                allowedRoles: ROLE_GROUPS.ADMINS
            },
            {
                title: 'Access Rules',
                path: '/admin/access-rules',
                icon: Settings,
                allowedRoles: ROLE_GROUPS.ADMINS
            },
            {
                title: 'System Audit Log',
                path: '/admin/audit-logs',
                icon: HistoryIcon,
                allowedRoles: ROLE_GROUPS.ADMINS
            },
            {
                title: 'System Health & Monitoring',
                path: '/admin/monitoring',
                icon: Activity,
                allowedRoles: ROLE_GROUPS.ADMINS
            },
            {
                title: 'RTOM Management',
                path: '/admin/opmcs',
                icon: Building2,
                allowedRoles: ROLE_GROUPS.ADMINS
            },
            {
                title: 'Store Management',
                path: '/admin/stores',
                icon: Warehouse,
                allowedRoles: ROLE_GROUPS.ADMINS
            },

            {
                title: 'Settings',
                path: '/admin/settings',
                icon: Settings,
                allowedRoles: [...ROLE_GROUPS.ADMINS, ...ROLE_GROUPS.OFFICE_ADMINS]
            },
            {
                title: 'SOD Import',
                path: '/admin/sod-import',
                icon: Upload,
                allowedRoles: ROLE_GROUPS.ADMINS
            },
            {
                title: 'Phoenix Bridge Monitor',
                path: '/admin/test-extension',
                icon: Terminal,
                allowedRoles: ROLE_GROUPS.ADMINS
            }
        ]
    }
];

// Helper function to check if a user has access
export const hasAccess = (
    userRole: string,
    allowedRoles: string[],
    isLoggedIn: boolean = true,
    itemTitle?: string,
    permissionId?: string,
    userPermissions?: string[]
) => {
    if (!isLoggedIn) {
        // Only allow public Guest items in sidebar/navigation
        return !!itemTitle && ['IT Help Desk', 'User Dashboard', 'Create Ticket'].includes(itemTitle);
    }

    // Super Admin & Admin always have full visibility
    if (userRole === 'SUPER_ADMIN' || userRole === 'ADMIN') return true;
    
    // Check if user role is explicitly allowed
    if (allowedRoles.includes('ALL') || allowedRoles.includes(userRole)) return true;

    // If dynamic permissions explicitly match, allow
    if (userPermissions && permissionId && userPermissions.includes(permissionId)) {
        return true;
    }

    return false;
};
