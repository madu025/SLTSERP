import { LucideIcon } from 'lucide-react';
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
    ClipboardCheck
} from 'lucide-react';

// Define Role Groups for easier management
export const ROLE_GROUPS = {
    ADMINS: ['SUPER_ADMIN', 'ADMIN'],
    OSP_OPS: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'OSP_MANAGER', 'AREA_MANAGER', 'ENGINEER', 'ASSISTANT_ENGINEER', 'AREA_COORDINATOR'],
    OFFICE_ADMINS: ['SUPER_ADMIN', 'ADMIN', 'OFFICE_ADMIN', 'OFFICE_ADMIN_ASSISTANT'],
    FINANCE: ['SUPER_ADMIN', 'ADMIN', 'FINANCE_MANAGER', 'FINANCE_ASSISTANT'],
    INVOICE: ['SUPER_ADMIN', 'ADMIN', 'INVOICE_MANAGER', 'INVOICE_ASSISTANT'],
    STORES: ['SUPER_ADMIN', 'ADMIN', 'STORES_MANAGER', 'STORES_ASSISTANT'],
    SA: ['SUPER_ADMIN', 'ADMIN', 'SA_MANAGER', 'SA_ASSISTANT'] // Service Assurance
};

export interface MenuItem {
    title: string;
    path: string;
    icon: LucideIcon;
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
        allowedRoles: ROLE_GROUPS.OSP_OPS,
        submenu: [
            {
                title: 'Pending SOD',
                path: '/service-orders',
                icon: FileText,
                allowedRoles: ROLE_GROUPS.OSP_OPS
            },
            {
                title: 'Return SOD',
                path: '/service-orders/return',
                icon: FileText,
                allowedRoles: ROLE_GROUPS.OSP_OPS
            },
            {
                title: 'Completed SOD',
                path: '/service-orders/completed',
                icon: FileText,
                allowedRoles: ROLE_GROUPS.OSP_OPS
            }
        ]
    },
    {
        title: 'Contractors',
        path: '/admin/contractors',
        icon: HardHat,
        allowedRoles: [...ROLE_GROUPS.OSP_OPS, ...ROLE_GROUPS.OFFICE_ADMINS]
    },
    {
        title: 'Restore Requests',
        path: '/restore-requests',
        icon: ClipboardCheck,
        allowedRoles: ROLE_GROUPS.OSP_OPS
    },
    {
        title: 'Invoices',
        path: '/invoices',
        icon: Receipt,
        allowedRoles: ROLE_GROUPS.INVOICE
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
                allowedRoles: ROLE_GROUPS.STORES
            },
            {
                title: 'Item Master',
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
                allowedRoles: ['SUPER_ADMIN', 'ADMIN', 'STORES_MANAGER'] // Restricted to managers
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
            }
        ]
    },
    {
        title: 'Staff Management',
        path: '/admin/staff',
        icon: Users,
        allowedRoles: ROLE_GROUPS.OFFICE_ADMINS
    },
    {
        title: 'User Management',
        path: '/admin/users',
        icon: UserCog,
        allowedRoles: ROLE_GROUPS.ADMINS
    },
    {
        title: 'OPMCs',
        path: '/admin/opmcs',
        icon: Building2,
        allowedRoles: ROLE_GROUPS.ADMINS
    },
    {
        title: 'System Settings',
        path: '/admin/table-settings',
        icon: Settings,
        allowedRoles: ROLE_GROUPS.ADMINS
    }
];

// Helper function to check if a user has access
export const hasAccess = (userRole: string, allowedRoles: string[]) => {
    if (allowedRoles.includes('ALL')) return true;
    return allowedRoles.includes(userRole);
};
