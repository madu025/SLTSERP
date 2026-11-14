import React from 'react';
import {
    Activity,
    Mail,
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
    Layers,
    Package,
    Lock,
    Tag,
    Globe,
    EyeOff,
    Trash2,
    Clock
} from 'lucide-react';


import { RBAC_PERMISSIONS, isCanonicalPermission } from "@/config/rbac-permissions";
import { resolveLegacyMenuPermission, resolvePageCapability } from "@/config/page-capabilities";

export interface MenuItem {
    title: string;
    path: string;
    icon: React.ComponentType<{ className?: string }>;
    permissionId?: string; // Dynamic permission ID
    submenu?: MenuItem[];
}

export const SIDEBAR_MENU: MenuItem[] = [
    {
        title: 'Contractor Field Portal',
        path: '/contractor/dashboard',
        icon: Truck,
        permissionId: 'contractor-portal',
        submenu: [
            {
                title: 'Overview',
                path: '/contractor/dashboard',
                icon: LayoutDashboard,
            },
            {
                title: 'My In-Hand Stock',
                path: '/contractor/inventory',
                icon: Package,
            },
            {
                title: 'Field SODs',
                path: '/contractor/sods',
                icon: ClipboardList,
            },
            {
                title: 'Claims & Payments',
                path: '/contractor/finance',
                icon: Banknote,
            }
        ]
    },
    {
        title: 'Dashboard',
        path: '/dashboard',
        icon: LayoutDashboard,
        permissionId: RBAC_PERMISSIONS.DASHBOARD_READ
    },
    {
        title: 'Service Orders',
        path: '/service-orders/work-order',
        icon: FileText,
        // Service Orders are main work for New Connection & Ops
        permissionId: RBAC_PERMISSIONS.SOD_READ,
        submenu: [
            {
                title: 'Pending SOD',
                path: '/service-orders/work-order',
                icon: FileText,
                permissionId: RBAC_PERMISSIONS.SOD_READ
            },
            {
                title: 'SOD Performance & SLA',
                path: '/service-orders/performance',
                icon: TrendingUp,
                permissionId: RBAC_PERMISSIONS.SOD_READ
            },
            {
                title: 'Install Closed SOD',
                path: '/service-orders/work-order/install-closed',
                icon: CheckCircle2,
                permissionId: RBAC_PERMISSIONS.SOD_READ
            },
            {
                title: 'Return SOD',
                path: '/service-orders/work-order/return',
                icon: FileText,
                permissionId: RBAC_PERMISSIONS.SOD_READ
            },
            {
                title: 'Disappeared SODs',
                path: '/service-orders/work-order/disappeared',
                icon: EyeOff,
                permissionId: RBAC_PERMISSIONS.SOD_READ
            },
            {
                title: 'Completed SOD',
                path: '/service-orders/work-order/completed',
                icon: FileCheck2,
                permissionId: RBAC_PERMISSIONS.SOD_READ
            },
            {
                title: 'Invoicable SODs',
                path: '/service-orders/invoicable',
                icon: Receipt,
                permissionId: RBAC_PERMISSIONS.SOD_INVOICE
            },
            {
                title: 'Material Deviation',
                path: '/service-orders/material-deviation',
                icon: Receipt,
                permissionId: RBAC_PERMISSIONS.SOD_INVOICE
            },
            {
                title: 'PAT Status Monitor',
                path: '/service-orders/work-order/pat',
                icon: ClipboardCheck,
                permissionId: RBAC_PERMISSIONS.SOD_READ
            },
            {
                title: 'Offline Work Orders',
                path: '/service-orders/work-order/offline-work-orders',
                icon: Tag,
                permissionId: RBAC_PERMISSIONS.SOD_READ
            }
        ]
    },
    {
        title: 'Contractors',
        path: '/contractors/management',
        icon: HardHat,
        permissionId: 'contractors',
        submenu: [
            {
                title: 'All Contractors',
                path: '/contractors/management',
                icon: HardHat,
            },
            {
                title: 'Contractor Scorecard',
                path: '/contractors/scorecard',
                icon: TrendingUp,
            },
            {
                title: 'Bulk Import',
                path: '/contractors/management/import',
                icon: Upload,
            }
        ]
    },
    {
        title: 'Projects',
        path: '/projects',
        icon: FolderKanban,
        // QA audit: removed SOD_PROJECT (ASSISTANT_ENGINEER, AREA_COORDINATOR, QC_OFFICER have no submenu access)
        permissionId: RBAC_PERMISSIONS.PROJECT_READ,
        submenu: [
            {
                title: 'All Projects',
                path: '/projects',
                icon: List,
                permissionId: RBAC_PERMISSIONS.PROJECT_READ
            },
            {
                title: 'My Tasks',
                path: '/projects/my-tasks',
                icon: ClipboardList,
                permissionId: RBAC_PERMISSIONS.PROJECT_READ
            },
            {
                title: 'PM Dashboard',
                path: '/projects/dashboards/pm',
                icon: BarChart2,
                permissionId: RBAC_PERMISSIONS.PROJECT_READ
            },
            {
                title: 'Finance Dashboard',
                path: '/projects/dashboards/financials',
                icon: LineChart,
                permissionId: RBAC_PERMISSIONS.FINANCE_READ
            },
            {
                title: 'QA/QC Dashboard',
                path: '/projects/dashboards/qaqc',
                icon: ClipboardList,
                permissionId: RBAC_PERMISSIONS.PROJECT_READ
            },
            {
                title: 'Logistics Dashboard',
                path: '/projects/dashboards/logistics',
                icon: Truck,
                permissionId: RBAC_PERMISSIONS.PROJECT_READ
            },
            {
                title: 'IR Material Audit',
                path: '/projects/dashboards/ir-audit',
                icon: FileText,
                permissionId: RBAC_PERMISSIONS.INVENTORY_READ
            },
            {
                title: 'National GIS Map',
                path: '/gis/map',
                icon: Route,
                permissionId: RBAC_PERMISSIONS.PROJECT_READ
            },
            {
                title: 'GIS File Import',
                path: '/gis/upload',
                icon: Upload,
                permissionId: RBAC_PERMISSIONS.PROJECT_WRITE
            },
        ]
    },

    {
        title: 'SF Audit Division',
        path: '/finance/sf-audit/governance',
        icon: ShieldCheck,
        permissionId: 'sf-audit',
        submenu: [
            {
                title: 'SF Audit Governance',
                path: '/finance/sf-audit/governance',
                icon: ShieldCheck,
            },
            {
                title: 'Contractor Invoice Pricing Audit',
                path: '/finance/sf-audit/pricing-audit',
                icon: Calculator,
            },
            {
                title: 'Header & Material Mapping Config',
                path: '/finance/sf-audit/header-mapping',
                icon: Settings,
            },
            {
                title: 'Payment Split Rules Configurator',
                path: '/finance/sf-audit/payment-split-config',
                icon: Calculator,
            }
        ]
    },

    {
        title: 'Inventory / Stores',
        path: '/inventory',
        icon: Warehouse,
        // Visibility is resolved from the canonical inventory capability.
        permissionId: 'inventory',
        submenu: [
            {
                title: 'Dashboard Overview',
                path: '/inventory',
                icon: LayoutDashboard,
            },
            {
                title: 'Inventory Health',
                path: '/inventory/health',
                icon: TrendingUp,
                permissionId: RBAC_PERMISSIONS.INVENTORY_READ
            },
            // 1. Setup & Master Data
            {
                title: 'Item Master Data', // Merged Material Registration + Bulk Import
                path: '/inventory/items',
                icon: FileText,
            },
            // 2. Stock Inflow
            {
                title: 'Goods Receipt (GRN)',
                path: '/inventory/grn',
                icon: Receipt,
            },
            {
                // Single Unified Hub: Stock Requests + Material Requests + Approvals
                title: 'Material Requisitions',
                path: '/inventory/requests',
                icon: ClipboardList,
            },
            {
                title: 'Project Material Control',
                path: '/inventory/project-materials',
                icon: Package,
                permissionId: RBAC_PERMISSIONS.INVENTORY_READ
            },
            // 3. Stock Outflow
            {
                title: 'Inventory Balance',
                path: '/inventory/stock',
                icon: BarChart3,
            },
            {
                title: 'Goods Issue (MIN)',
                path: '/inventory/issues',
                icon: PackageMinus,
            },
            {
                title: 'Inventory Adjustments (Wastage)',
                path: '/inventory/admin/wastage',
                icon: ClipboardCheck,
            },
            // Contractor custody and store set-up pages that previously had no navigation entry
            {
                title: 'Contractor Material Issue',
                path: '/inventory/admin/issue',
                icon: PackageMinus,
            },
            {
                title: 'Contractor Returns',
                path: '/inventory/admin/returns',
                icon: RefreshCw,
            },
            {
                title: 'Contractor Balance Sheet',
                path: '/inventory/admin/balance-sheet',
                icon: ClipboardCheck,
            },
            {
                title: 'Initial Stock Setup',
                path: '/inventory/admin/initial',
                icon: BarChart3,
            },
            {
                title: 'Virtual Material Swap',
                path: '/inventory/admin/virtual-swap',
                icon: RefreshCw,
            },
            // 4. Returns & Reconciliation
            {
                title: 'Material Returns (MRN)',
                path: '/inventory/admin/mrns',
                icon: RefreshCw,
            },
            {
                title: 'Physical Stock Take & Recon', // Merged Material Reconciliation, Contractor Balance Sheet, Material Audit, Inventory Audit
                path: '/inventory/audit',
                icon: ShieldCheck,
            },
            {
                title: 'Pre-ERP Legacy Recon',
                path: '/inventory/admin/pre-erp-reconciliation',
                icon: HistoryIcon,
            },
            // 5. Analytics & History
            {
                title: 'Stock Ledger (Cardex)',
                path: '/inventory/reports/cardex',
                icon: HistoryIcon,
            },
            {
                title: 'Material Consumption Report',
                path: '/inventory/reports/material-summary',
                icon: BarChart3,
            }
        ]
    },
    {
        title: 'Approvals',
        path: '/procurement/approvals',
        icon: FileSignature,
        permissionId: 'restore_requests',
        submenu: [
            {
                title: 'Material Requests & Approvals',
                path: '/inventory/requests',
                icon: ClipboardList,
            },
            {
                title: 'Procurement Approvals',
                path: '/procurement/approvals',
                icon: FileSignature,
            },
            {
                title: 'Contractor Registration Approvals',
                path: '/contractors/management/approvals',
                icon: FileSignature,
            }
        ]
    },
    {
        title: 'Procurement',
        path: '/procurement',
        icon: ShoppingCart,
        permissionId: 'procurement',
        submenu: [
            {
                title: 'Overview',
                path: '/procurement',
                icon: LayoutDashboard,
            },
            {
                title: 'Purchase Orders',
                path: '/procurement/orders',
                icon: FileText,
            },
            {
                title: 'AI Forecast & PO Builder',
                path: '/procurement/forecast',
                icon: FileText,
            },
            {
                title: 'Procurement Performance',
                path: '/procurement/performance',
                icon: TrendingUp,
                permissionId: RBAC_PERMISSIONS.PROCUREMENT_READ
            },
            {
                title: 'Vendor Scorecard',
                path: '/procurement/vendors',
                icon: TrendingUp,
                permissionId: RBAC_PERMISSIONS.PROCUREMENT_READ
            }
        ]
    },
    {
        title: 'Finance & Accounting',
        path: '/finance/chart-of-accounts',
        icon: Calculator,
        permissionId: 'corporate-finance',
        submenu: [
            {
                title: 'Finance Setup & Ops',
                path: '#',
                icon: Banknote,
                permissionId: 'finance-ops',
                submenu: [
                    {
                        title: 'SLT SLA Agreements',
                        path: '/finance/slt-contracts',
                        icon: FileCheck2,
                    },
                    {
                        title: 'Vendor Registry',
                        path: '/finance/vendors',
                        icon: Building,
                    },
                    {
                        title: 'Bank Registry',
                        path: '/finance/banks',
                        icon: Landmark,
                    },
                    {
                        title: 'Payment Vouchers',
                        path: '/finance/payments',
                        icon: Receipt,
                    },
                    {
                        title: 'Petty Cash',
                        path: '/finance/petty-cash',
                        icon: Banknote,
                    },
                    {
                        title: 'Retention Management',
                        path: '/finance/retention',
                        icon: Shield,
                    },
                    {
                        title: 'LD Penalties',
                        path: '/finance/ld-penalties',
                        icon: ShieldAlert,
                    },
                    {
                        title: 'Rate Matrix Config',
                        path: '/finance/rate-matrix',
                        icon: Calculator,
                    },
                    {
                        title: 'CAPEX / OPEX Dashboard',
                        path: '/finance/capex-opex',
                        icon: TrendingUp,
                    },
                    {
                        title: 'WIP Revenue & Billing Pipeline',
                        path: '/finance/wip-revenue',
                        icon: TrendingUp,
                    },
                    {
                        title: 'Budget Allocations',
                        path: '/finance/budget',
                        icon: PieChart,
                    },
                    {
                        title: 'Vendor Upload (HO)',
                        path: '/finance/vendors/import',
                        icon: Upload,
                    },
                    {
                        title: 'Bank Upload (HO)',
                        path: '/finance/banks/import',
                        icon: Upload,
                    }
                ]
            },
            {
                title: 'Billing & Invoices',
                path: '#',
                icon: FileSignature,
                permissionId: 'billing',
                submenu: [
                    {
                        title: 'Submit Invoices (SLT)',
                        path: '/invoices',
                        icon: Receipt,
                    },
                    {
                        title: 'BOM Sheets (Imports)',
                        path: '/invoices/bom-sheets',
                        icon: Upload,
                    },
                    {
                        title: 'Cost Allocation',
                        path: '/finance/cost-allocation',
                        icon: FileSignature,
                    },
                    {
                        title: 'SOD Revenue Config',
                        path: '/finance/sod-revenue',
                        icon: Receipt,
                    }
                ]
            },
            {
                title: 'OSP Accounts',
                path: '#',
                icon: Landmark,
                permissionId: 'osp-account',
                submenu: [
                    {
                        title: 'OSP Dashboard',
                        path: '/finance/osp-account-reports',
                        icon: Receipt,
                    },
                    {
                        title: 'Petty Cash IOUs',
                        path: '/finance/osp-account/ious',
                        icon: Receipt,
                    },
                    {
                        title: 'Project Advances',
                        path: '/finance/osp-account/advances',
                        icon: Receipt,
                    },
                    {
                        title: 'Property Rents',
                        path: '/finance/osp-account/rents',
                        icon: Receipt,
                    },
                    {
                        title: 'Fleet Ledger',
                        path: '/finance/osp-account/fleet',
                        icon: Receipt,
                    }
                ]
            },
            {
                title: 'Accounting & Reporting',
                path: '#',
                icon: Layers,
                submenu: [
            // — General Ledger —
            {
                title: 'General Ledger',
                path: '/finance/general-ledger',
                icon: Layers,
            },
            // — Financial Reporting —
            {
                title: 'Chart of Accounts',
                path: '/finance/chart-of-accounts',
                icon: List,
            },
            {
                title: 'Trial Balance',
                path: '/finance/reports/trial-balance',
                icon: Scale,
            },
            {
                title: 'Profit & Loss Statement',
                path: '/finance/reports/pnl',
                icon: TrendingUp,
            },
            {
                title: 'Balance Sheet',
                path: '/finance/reports/balance-sheet',
                icon: Landmark,
            },
            {
                title: 'Revenue Recognition (POC)',
                path: '/finance/revenue-recognition',
                icon: TrendingUp,
            },
            {
                title: 'Liabilities Schedule',
                path: '/finance/liabilities',
                icon: Scale,
            },
            {
                title: 'Budget vs Actual (GL)',
                path: '/finance/budget-vs-actual',
                icon: Scale,
            },
            {
                title: 'Profitability by OPMC & Project',
                path: '/finance/reports/profitability',
                icon: Layers,
            },
            {
                title: 'Cash Flow Statement',
                path: '/finance/reports/cash-flow',
                icon: TrendingUp,
            },
            {
                title: 'GL Account Drill-down',
                path: '/finance/reports/gl-viewer',
                icon: Layers,
            },
            {
                title: 'FP&A Variance Dashboard',
                path: '/finance/fpa-dashboard',
                icon: Activity,
            },
            // — Tax & Compliance —
                ]
            },
            {
                title: 'Tax, AR & AP',
                path: '#',
                icon: Receipt,
                submenu: [
            {
                title: 'VAT Return & Tax Register',
                path: '/finance/tax/vat-return',
                icon: Receipt,
            },
            {
                title: 'WHT Certificates & Register',
                path: '/finance/tax/wht-register',
                icon: FileCheck2,
            },
            // — Receivables & Payables —
            {
                title: 'Cash Forecast & Receivables Risk',
                path: '/finance/cash-forecast',
                icon: Users,
            },
            {
                title: 'AR Aging & Collections',
                path: '/finance/ar/aging',
                icon: Users,
            },
            {
                title: 'AP Aging & Payables',
                path: '/finance/ap/aging',
                icon: Building2,
            },
            {
                title: 'Credit & Debit Notes',
                path: '/finance/credit-notes',
                icon: FileText,
            },
            // — Banking & Cash —
                ]
            },
            {
                title: 'Treasury & Reconciliation',
                path: '#',
                icon: Landmark,
                submenu: [
            {
                title: 'Bank Reconciliation',
                path: '/finance/bank/reconciliation',
                icon: CheckCircle2,
            },
            {
                title: 'Cash Book & Bank Ledger',
                path: '/finance/bank/cash-book',
                icon: Landmark,
            },
            {
                title: 'Multi-Currency FX Rates',
                path: '/finance/exchange-rates',
                icon: Globe,
            },
            // — Assets & Payroll —
                ]
            },
            {
                title: 'Assets & Payroll',
                path: '#',
                icon: Package,
                submenu: [
            {
                title: 'Fixed Asset Register & Depreciation',
                path: '/finance/fixed-assets',
                icon: Package,
            },
            {
                title: 'HO Payroll Expense Allocation',
                path: '/finance/payroll',
                icon: Users,
            },
            // — Period Close & Approvals —
                ]
            },
            {
                title: 'Billing & Period Controls',
                path: '#',
                icon: Lock,
                submenu: [
            {
                title: 'Financial Period Close & Year-End',
                path: '/finance/period-close',
                icon: Lock,
            },
            {
                title: 'Contractor Billing',
                path: '/finance/billing',
                icon: FileText,
            },
            {
                title: 'Invoice Approvals',
                path: '/finance/invoices',
                icon: CheckCircle2,
                }
                ]
            }
        ]
    },

    {
        title: 'Reports & Analytics',
        path: '/reports',
        icon: FileText,
        submenu: [
            {
                title: 'Executive Overview',
                path: '/reports/manager',
                icon: LayoutDashboard,
            },
            {
                title: 'Area Performance',
                path: '/reports/arm',
                icon: Building2,
            },
            {
                title: 'Daily Operational',
                path: '/reports/daily-operational',
                icon: FileText,
            }
        ]
    },

    {
        title: 'Vehicle & Fleet Management',
        path: '/fleet/vehicles',
        icon: Car,
        submenu: [
            {
                title: 'All Vehicles',
                path: '/fleet/vehicles',
                icon: Car,
            },
            {
                title: 'Drivers Directory',
                path: '/fleet/drivers',
                icon: Users,
            },
            {
                title: 'Fleet Payments',
                path: '/fleet/payments',
                icon: Banknote,
            },
            {
                title: 'Trip Management',
                path: '/fleet/trips',
                icon: Truck,
            },
            {
                title: 'Fleet Reports',
                path: '/reports/fleet',
                icon: BarChart3,
            }
        ]
    },
    {
        title: 'Administration',
        path: '/admin',
        icon: UserCog,
        // Visibility is resolved from the page capability and database grants.
        permissionId: 'administration',
        submenu: [
            {
                title: 'User Guide & Docs',
                path: '/admin/guide',
                icon: FileText,
            },
            {
                title: 'User Management',
                path: '/admin/users',
                icon: Users,
            },
            {
                title: 'Bulk User Import',
                path: '/admin/users/import',
                icon: Upload,
            },
            {
                title: 'Section Role Permissions',
                path: '/admin/roles',
                icon: ShieldCheck,
            },
            {
                title: 'Department Sections',
                path: '/admin/sections',
                icon: Layers,
            },
            {
                title: 'Staff Hierarchy Master',
                path: '/admin/staff',
                icon: Users,
            },


            {
                title: 'System Audit Log',
                path: '/admin/audit-logs',
                icon: HistoryIcon,
            },
            {
                title: 'Control Monitor',
                path: '/admin/control',
                icon: HistoryIcon,
            },
            {
                title: 'System Health & Monitoring',
                path: '/admin/monitoring',
                icon: Activity,
            },
            {
                title: 'RTOM Management',
                path: '/projects/opmcs',
                icon: Building2,
            },
            {
                title: 'Store Management',
                path: '/inventory/stores',
                icon: Warehouse,
            },

            {
                title: 'Settings',
                path: '/admin/settings',
                icon: Settings,
            },
            {
                title: 'Process Gates Engine',
                path: '/admin/settings/process-gates',
                icon: ShieldCheck,
            },
            {
                title: 'SMTP Email Config',
                path: '/admin/settings/smtp',
                icon: Mail,
            },
            {
                title: 'SOD Import',
                path: '/service-orders/import',
                icon: Upload,
            },
            {
                title: 'Bridge Monitor',
                path: '/admin/test-extension',
                icon: Terminal,
            }
        ]
    },
    {
        title: 'ITMS & IT Help Desk',
        path: '/helpdesk',
        icon: LifeBuoy,
        submenu: [
            {
                title: 'User Portal',
                path: '/helpdesk',
                icon: LifeBuoy,
            },
            {
                title: 'New Support Ticket',
                path: '/helpdesk/tickets/new',
                icon: FileText,
            },
            {
                title: 'IT Admin Queue',
                path: '/helpdesk/admin',
                icon: ClipboardList,
            },
            {
                title: 'IT Asset Management',
                path: '/helpdesk/assets',
                icon: Laptop,
            },
            {
                title: 'Asset Disposals (Maker-Checker)',
                path: '/helpdesk/disposals',
                icon: Trash2,
            },
            {
                title: 'Asset Depreciation & GL',
                path: '/helpdesk/depreciation',
                icon: Calculator,
            },
            {
                title: 'Live Device Telemetry',
                path: '/helpdesk/telemetry',
                icon: Activity,
            },
            {
                title: 'SLA Breach Monitor',
                path: '/helpdesk/sla-monitor',
                icon: Clock,
            },
            {
                title: 'Physical Asset Audits',
                path: '/helpdesk/assets/audits',
                icon: ClipboardCheck,
            },
            {
                title: 'Software Licenses (SAM)',
                path: '/helpdesk/software-licenses',
                icon: Tag,
            },
            {
                title: 'ITSM Reports & Analytics',
                path: '/helpdesk/reports',
                icon: BarChart3,
            }
        ]
    }
];

export interface MenuAccessOptions {
    isLoggedIn?: boolean;
    itemTitle?: string;
    permissionId?: string;
    userPermissions?: string[];
    pathname?: string;
}

/**
 * Resolve sidebar visibility from the session's canonical capabilities.
 * Role labels and menu metadata are deliberately not part of this decision.
 */
export const canAccessMenuItem = ({
    isLoggedIn = true,
    itemTitle,
    permissionId,
    userPermissions,
    pathname,
}: MenuAccessOptions) => {
    if (!isLoggedIn) {
        // Only allow public Guest items in sidebar/navigation
        return !!itemTitle && ['IT Help Desk', 'ITMS & IT Help Desk', 'User Dashboard', 'Create Ticket'].includes(itemTitle);
    }

    const canonicalPermission = (permissionId && isCanonicalPermission(permissionId))
        ? permissionId
        : (pathname ? resolvePageCapability(pathname) : undefined) ?? resolveLegacyMenuPermission(permissionId);
    return !!canonicalPermission && !!userPermissions?.includes(canonicalPermission);
};
