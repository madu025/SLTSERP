import React from 'react';
import {
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
    PackageMinus,
    Shield,
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
    submenu?: MenuItem[];
}

export const SIDEBAR_MENU: MenuItem[] = [
    {
        title: 'Dashboard',
        path: '/dashboard',
        icon: LayoutDashboard,
        allowedRoles: ['ALL'] // Special keyword for public/all access
    },
    {
        title: 'Vehicle Management',
        path: '/vehicles',
        icon: Car,
        allowedRoles: ['ALL'],
        submenu: [
            {
                title: 'All Vehicles',
                path: '/vehicles',
                icon: Car,
                allowedRoles: ['ALL']
            },
            {
                title: 'Trips',
                path: '/trips',
                icon: Route,
                allowedRoles: ['ALL']
            },
            {
                title: 'Drivers',
                path: '/drivers',
                icon: Users,
                allowedRoles: ['ALL']
            },
            {
                title: 'Payments',
                path: '/payments',
                icon: Banknote,
                allowedRoles: ['ALL']
            },
            {
                title: 'Fleet Reports',
                path: '/reports/fleet',
                icon: BarChart3,
                allowedRoles: ['ALL']
            }
        ]
    },
    {
        title: 'Service Orders',
        path: '/service-orders',
        icon: FileText,
        // Service Orders are main work for New Connection & Ops
        allowedRoles: ROLE_GROUPS.ALL_OPS,
        submenu: [
            {
                title: 'Pending SOD',
                path: '/service-orders',
                icon: FileText,
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
                icon: FileText,
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
        ]
    },

    {
        title: 'Finance & Accounts',
        path: '/admin/finance',
        icon: Banknote,
        allowedRoles: [...ROLE_GROUPS.ADMINS, ...ROLE_GROUPS.FINANCE, ...ROLE_GROUPS.INVOICE, 'OSP_MANAGER', 'AREA_MANAGER', 'MANAGER', 'ENGINEER', 'ASSISTANT_ENGINEER', 'AREA_COORDINATOR', 'QC_OFFICER'],
        submenu: [
            {
                title: 'Contractor Invoices',
                path: '/invoices',
                icon: Receipt,
                allowedRoles: [
                    ...ROLE_GROUPS.ADMINS,
                    ...ROLE_GROUPS.INVOICE,
                    ...ROLE_GROUPS.FINANCE,
                    'MANAGER', 'OSP_MANAGER', 'AREA_MANAGER', 'ENGINEER', 'ASSISTANT_ENGINEER', 'AREA_COORDINATOR', 'QC_OFFICER'
                ]
            },
            {
                title: 'Cost Allocation',
                path: '/admin/finance/cost-allocation',
                icon: FileSignature,
                allowedRoles: [...ROLE_GROUPS.ADMINS, ...ROLE_GROUPS.FINANCE, 'OSP_MANAGER']
            },
            {
                title: 'Contractor Pricing',
                path: '/admin/contractor-payment',
                icon: Receipt,
                allowedRoles: ROLE_GROUPS.ADMINS
            },
            {
                title: 'SOD Revenue Config',
                path: '/admin/sod-revenue',
                icon: Receipt,
                allowedRoles: ROLE_GROUPS.ADMINS
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
        title: 'Inventory / Stores',
        path: '/inventory',
        icon: Warehouse,
        allowedRoles: ROLE_GROUPS.STORES,
        submenu: [
            // 1. Setup & Master Data
            {
                title: 'Material Registration',
                path: '/inventory/items',
                icon: FileText,
                allowedRoles: ['SUPER_ADMIN', 'ADMIN', 'STORES_MANAGER']
            },
            {
                title: 'Bulk Import',
                path: '/inventory/items/import',
                icon: FileText,
                allowedRoles: ['SUPER_ADMIN', 'ADMIN']
            },
            {
                title: 'Initial Stock',
                path: '/admin/inventory/initial',
                icon: Warehouse,
                allowedRoles: ['SUPER_ADMIN', 'ADMIN', 'STORES_MANAGER']
            },
            // 2. Stock Inflow
            {
                title: 'GRN Entry',
                path: '/inventory/grn',
                icon: Receipt,
                allowedRoles: ['SUPER_ADMIN', 'ADMIN', 'STORES_MANAGER']
            },
            {
                title: 'Stock Requests',
                path: '/inventory/requests',
                icon: ClipboardCheck,
                allowedRoles: ['SUPER_ADMIN', 'ADMIN', 'STORES_MANAGER', 'OSP_MANAGER']
            },
            {
                title: 'Material Request',
                path: '/admin/inventory/requests/create',
                icon: ClipboardCheck,
                allowedRoles: ['SUPER_ADMIN', 'ADMIN', 'STORES_MANAGER', 'STORES_ASSISTANT']
            },
            {
                title: 'My Requests',
                path: '/admin/inventory/requests/my-requests',
                icon: ClipboardCheck,
                allowedRoles: ['SUPER_ADMIN', 'ADMIN', 'STORES_MANAGER', 'STORES_ASSISTANT']
            },
            // 3. Status & Outflow
            {
                title: 'Stock Levels',
                path: '/inventory/stock',
                icon: Warehouse,
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
                icon: PackageMinus,
                allowedRoles: ['SUPER_ADMIN', 'ADMIN', 'STORES_MANAGER', 'OSP_MANAGER']
            },
            // 4. Returns & Reconciliation
            {
                title: 'MRN (Material Return)',
                path: '/admin/inventory/mrns',
                icon: Receipt,
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
                title: 'Dashboard',
                path: '/inventory',
                icon: LayoutDashboard,
                allowedRoles: ROLE_GROUPS.STORES
            },
            {
                title: 'Transaction History',
                path: '/inventory/reports/cardex',
                icon: FileText,
                allowedRoles: ['SUPER_ADMIN', 'ADMIN', 'STORES_MANAGER']
            }
        ]
    },
    {
        title: 'Approvals',
        path: '/procurement/approvals',
        icon: FileSignature,
        allowedRoles: ['SUPER_ADMIN', 'ADMIN', 'OSP_MANAGER', 'MANAGER', ...ROLE_GROUPS.ALL_OPS],
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
        title: 'Administration',
        path: '/admin',
        icon: UserCog,
        allowedRoles: [...ROLE_GROUPS.ADMINS, ...ROLE_GROUPS.OFFICE_ADMINS],
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
export const hasAccess = (userRole: string, allowedRoles: string[]) => {
    if (allowedRoles.includes('ALL')) return true;
    return allowedRoles.includes(userRole);
};
