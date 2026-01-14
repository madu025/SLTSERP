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
    History,
    RefreshCw
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
    icon: any;
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
        // Contractors managed by Ops & Admin, plus Finance/Invoice need access to Invoices submenu
        allowedRoles: [...ROLE_GROUPS.OSP_PROJECTS, ...ROLE_GROUPS.NEW_CONNECTION, ...ROLE_GROUPS.OFFICE_ADMINS, ...ROLE_GROUPS.FINANCE, ...ROLE_GROUPS.INVOICE],
        submenu: [
            {
                title: 'All Contractors',
                path: '/admin/contractors',
                icon: HardHat,
                allowedRoles: [...ROLE_GROUPS.OSP_PROJECTS, ...ROLE_GROUPS.NEW_CONNECTION, ...ROLE_GROUPS.OFFICE_ADMINS]
            },
            {
                title: 'Contractor Invoices',
                path: '/invoices',
                icon: Receipt,
                allowedRoles: [
                    ...ROLE_GROUPS.ADMINS,
                    ...ROLE_GROUPS.INVOICE,
                    ...ROLE_GROUPS.FINANCE,
                    'MANAGER', 'OSP_MANAGER', 'AREA_MANAGER', 'ENGINEER', 'ASSISTANT_ENGINEER'
                ]
            },
            {
                title: 'Registration Approvals',
                path: '/admin/contractors/approvals',
                icon: FileSignature,
                allowedRoles: ROLE_GROUPS.ALL_OPS
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
        allowedRoles: [...ROLE_GROUPS.ADMINS, ...ROLE_GROUPS.OSP_PROJECTS]
    },

    {
        title: 'Inventory / Stores',
        path: '/inventory',
        icon: Warehouse,
        allowedRoles: ROLE_GROUPS.STORES,
        submenu: [
            {
                title: 'Dashboard',
                path: '/inventory',
                icon: LayoutDashboard,
                allowedRoles: ROLE_GROUPS.STORES
            },
            {
                title: 'Stock Levels',
                path: '/inventory/stock',
                icon: Warehouse,
                allowedRoles: ROLE_GROUPS.STORES
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
                title: 'Transaction History',
                path: '/inventory/reports/cardex',
                icon: FileText,
                allowedRoles: ['SUPER_ADMIN', 'ADMIN', 'STORES_MANAGER']
            },
            {
                title: 'GRN Entry',
                path: '/inventory/grn',
                icon: Receipt,
                allowedRoles: ['SUPER_ADMIN', 'ADMIN', 'STORES_MANAGER']
            },
            {
                title: 'Stock Issue',
                path: '/inventory/issues',
                icon: PackageMinus,
                allowedRoles: ['SUPER_ADMIN', 'ADMIN', 'STORES_MANAGER', 'STORES_ASSISTANT']
            },
            {
                title: 'MRN (Material Return)',
                path: '/admin/inventory/mrn/create',
                icon: Receipt,
                allowedRoles: ['SUPER_ADMIN', 'ADMIN', 'STORES_MANAGER', 'STORES_ASSISTANT']
            },
            {
                title: 'Manage Stores',
                path: '/admin/stores',
                icon: Building2,
                allowedRoles: ['SUPER_ADMIN', 'ADMIN']
            },
            {
                title: 'Initial Stock',
                path: '/admin/inventory/initial',
                icon: Warehouse,
                allowedRoles: ['SUPER_ADMIN', 'ADMIN', 'STORES_MANAGER']
            },
            {
                title: 'Contractor Balance Sheet',
                path: '/contractors/balance-sheet',
                icon: FileText,
                allowedRoles: ['SUPER_ADMIN', 'ADMIN', 'STORES_MANAGER', 'STORES_ASSISTANT']
            },
            {
                title: 'Material Reconciliation',
                path: '/admin/inventory/reconciliation',
                icon: ClipboardCheck,
                allowedRoles: ROLE_GROUPS.STORES
            }
        ]
    },
    {
        title: 'OSP Managers',
        path: '/procurement/approvals',
        icon: Users,
        // Approvals needed by OSP Managers and New Connection Managers
        allowedRoles: ['SUPER_ADMIN', 'ADMIN', 'OSP_MANAGER', 'MANAGER'],
        submenu: [
            {
                title: 'Approvals',
                path: '/procurement/approvals',
                icon: FileSignature,
                allowedRoles: ['SUPER_ADMIN', 'ADMIN', 'OSP_MANAGER', 'MANAGER']
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
                icon: History,
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
                title: 'SOD Revenue Config',
                path: '/admin/sod-revenue',
                icon: Receipt,
                allowedRoles: ROLE_GROUPS.ADMINS
            },
            {
                title: 'Contractor Pricing',
                path: '/admin/contractor-payment',
                icon: Receipt,
                allowedRoles: ROLE_GROUPS.ADMINS
            },
            {
                title: 'Settings',
                path: '/admin/settings',
                icon: Settings,
                allowedRoles: [...ROLE_GROUPS.ADMINS, ...ROLE_GROUPS.OFFICE_ADMINS]
            }
        ]
    }
];

// Helper function to check if a user has access
export const hasAccess = (userRole: string, allowedRoles: string[]) => {
    if (allowedRoles.includes('ALL')) return true;
    return allowedRoles.includes(userRole);
};
