import React from 'react';
import {
    Activity,
    Mail,
    LayoutDashboard,
    Send,
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
    BookOpen,
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
    Clock,
    ScanBarcode,
} from 'lucide-react';


import { levelAllowsItem, type AccessLevel, type MenuModule } from './menu-access';
import { RBAC_PERMISSIONS, isCanonicalPermission } from "@/config/rbac-permissions";
import { resolveLegacyMenuPermission, resolvePageCapability } from "@/config/page-capabilities";

export interface MenuItem {
    title: string;
    path: string;
    icon: React.ComponentType<{ className?: string }>;
    permissionId?: string; // Dynamic permission ID
    /** The module the item belongs to (a submenu item takes its parent's); with `level` it decides who sees the item by designation. */
    module?: MenuModule;
    /** The access level of the person's designation in the module that this item needs (see menu-access.ts). */
    level?: AccessLevel;
    submenu?: MenuItem[];
}

export const SIDEBAR_MENU: MenuItem[] = [
    {
        title: 'Contractor Field Portal',
        path: '/contractor/dashboard',
        icon: Truck,
        permissionId: RBAC_PERMISSIONS.CONTRACTOR_WRITE, // the field portal is for the contractors' own people, not for the staff who oversee them
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
                title: 'Verify Orders',
                path: '/contractor/verify-sods',
                icon: CheckCircle2,
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
        // the step-by-step system guides (src/content/guides): every office user, like the dashboard and the profile
        title: 'Help',
        path: '/help',
        icon: BookOpen,
        permissionId: RBAC_PERMISSIONS.DASHBOARD_READ
    },
    {
        title: 'Service Orders',
        path: '/service-orders/work-order',
        icon: FileText,
        // Service Orders are main work for New Connection & Ops
        permissionId: RBAC_PERMISSIONS.SOD_READ,
        module: 'SOD',
        submenu: [
            {
                title: 'Pending SOD',
                level: 'view',
                path: '/service-orders/work-order',
                icon: FileText,
                permissionId: RBAC_PERMISSIONS.SOD_READ
            },
            {
                title: 'Install Closed SOD',
                level: 'view',
                path: '/service-orders/work-order/install-closed',
                icon: CheckCircle2,
                permissionId: RBAC_PERMISSIONS.SOD_READ
            },
            {
                title: 'Completed SOD',
                level: 'view',
                path: '/service-orders/work-order/completed',
                icon: FileCheck2,
                permissionId: RBAC_PERMISSIONS.SOD_READ
            },
            {
                title: 'Return SOD',
                level: 'view',
                path: '/service-orders/work-order/return',
                icon: FileText,
                permissionId: RBAC_PERMISSIONS.SOD_READ
            },
            {
                title: 'Disappeared SODs',
                level: 'view',
                path: '/service-orders/work-order/disappeared',
                icon: EyeOff,
                permissionId: RBAC_PERMISSIONS.SOD_READ
            },
            {
                title: 'PAT Status Monitor',
                level: 'view',
                path: '/service-orders/work-order/pat',
                icon: ClipboardCheck,
                permissionId: RBAC_PERMISSIONS.SOD_READ
            },
            {
                // Any service order person can tell a contractor where an invoice is on its way to payment
                level: 'view',
                title: 'Invoice Status',
                path: '/service-orders/invoice-status',
                icon: Receipt,
                permissionId: RBAC_PERMISSIONS.INVOICE_STATUS_READ,
            },
            {
                // The Area Manager's main decision: the invoices of the area waiting for approval
                title: 'Invoice Approvals',
                level: 'approve',
                path: '/invoices/confirmations',
                icon: Receipt,
                permissionId: RBAC_PERMISSIONS.INVOICE_CONFIRM_MANAGER
            },
            {
                // Contractor registrations waiting for the Area Manager (the Area Manager step of the registration approval); the Contractors menu is not the Area Manager's
                title: 'Contractor Approvals',
                level: 'approve',
                path: '/contractors/management/approvals',
                icon: FileSignature,
                permissionId: RBAC_PERMISSIONS.INVOICE_CONFIRM_MANAGER
            },
            {
                title: 'Invoicing',
                level: 'invoice',
                path: '/service-orders/invoicing',
                icon: Receipt,
                permissionId: RBAC_PERMISSIONS.SOD_INVOICE
            },
            {
                title: 'Material Deviation',
                level: 'invoice',
                path: '/service-orders/material-deviation',
                icon: Receipt,
                permissionId: RBAC_PERMISSIONS.SOD_INVOICE
            },
            {
                // SLT CPE Locator serials of the person's RTOMs; only the Area Coordinator and QC Officer record (scan) them - not the stores
                title: 'CPE Serials',
                level: 'view',
                path: '/service-orders/cpe-serials',
                icon: ScanBarcode,
                permissionId: RBAC_PERMISSIONS.INVENTORY_CPE_READ
            },
            {
                // Only the contractors of the person's own RTOMs, view only
                title: 'Contractors & Stock',
                level: 'view',
                path: '/service-orders/contractor-stock',
                icon: Package,
                permissionId: RBAC_PERMISSIONS.SOD_READ
            },
            {
                title: 'SOD Performance & SLA',
                level: 'view',
                path: '/service-orders/performance',
                icon: TrendingUp,
                permissionId: RBAC_PERMISSIONS.SOD_READ
            }
        ]
    },
    {
        title: 'Contractors',
        path: '/contractors/management',
        icon: HardHat,
        permissionId: RBAC_PERMISSIONS.CONTRACTOR_READ, // everyone who reads contractors sees the scorecard; the register and the import are the administrator's (their pages need admin.rbac)
        submenu: [
            {
                title: 'All Contractors',
                path: '/contractors/management',
                icon: HardHat,
                permissionId: RBAC_PERMISSIONS.ADMIN_RBAC,
            },
            {
                title: 'Contractor Scorecard',
                path: '/contractors/scorecard',
                icon: TrendingUp,
                permissionId: RBAC_PERMISSIONS.CONTRACTOR_READ,
            },
            {
                title: 'Bulk Import',
                path: '/contractors/management/import',
                icon: Upload,
                permissionId: RBAC_PERMISSIONS.ADMIN_RBAC,
            }
        ]
    },
    {
        title: 'Projects',
        path: '/projects',
        icon: FolderKanban,
        // QA audit: removed SOD_PROJECT (ASSISTANT_ENGINEER, AREA_COORDINATOR, QC_OFFICER have no submenu access)
        permissionId: RBAC_PERMISSIONS.PROJECT_READ,
        module: 'PROJECTS',
        submenu: [
            {
                title: 'All Projects',
                level: 'view',
                path: '/projects',
                icon: List,
                permissionId: RBAC_PERMISSIONS.PROJECT_READ
            },
            {
                title: 'My Tasks',
                level: 'operate',
                path: '/projects/my-tasks',
                icon: ClipboardList,
                permissionId: RBAC_PERMISSIONS.PROJECT_READ
            },
            {
                title: 'PM Dashboard',
                level: 'operate', // the people who run projects; the finance, stores and audit readers have their own dashboards
                path: '/projects/dashboards/pm',
                icon: BarChart2,
                permissionId: RBAC_PERMISSIONS.PROJECT_READ
            },
            {
                title: 'Finance Dashboard',
                level: 'view',
                path: '/projects/dashboards/financials',
                icon: LineChart,
                permissionId: RBAC_PERMISSIONS.PROJECT_FINANCE_DASHBOARD
            },
            {
                title: 'QA/QC Dashboard',
                level: 'operate',
                path: '/projects/dashboards/qaqc',
                icon: ClipboardList,
                permissionId: RBAC_PERMISSIONS.PROJECT_READ
            },
            {
                title: 'Logistics Dashboard',
                level: 'view',
                path: '/projects/dashboards/logistics',
                icon: Truck,
                permissionId: RBAC_PERMISSIONS.INVENTORY_READ // material and stock: for the people who read the stores, not for the cashier
            },
            {
                title: 'IR Material Audit',
                level: 'view',
                path: '/projects/dashboards/ir-audit',
                icon: FileText,
                permissionId: RBAC_PERMISSIONS.INVENTORY_READ
            },
            {
                title: 'National GIS Map',
                level: 'view',
                path: '/gis/map',
                icon: Route,
                permissionId: RBAC_PERMISSIONS.PROJECT_READ
            },
            {
                title: 'GIS File Import',
                level: 'operate',
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
                title: 'Invoices to Verify',
                path: '/finance/sf-audit/queue',
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
        module: 'INVENTORY',
        submenu: [
            {
                title: 'Dashboard Overview',
                level: 'view',
                path: '/inventory',
                icon: LayoutDashboard,
            },
            {
                // Single Unified Hub: Stock Requests + Material Requests + Approvals
                title: 'Material Requisitions',
                level: 'view',
                path: '/inventory/requests',
                icon: ClipboardList,
            },
            {
                title: 'Daily work',
                path: '#',
                icon: ClipboardList,
                level: 'operate',
                permissionId: RBAC_PERMISSIONS.INVENTORY_WRITE,
                submenu: [
                    {
                        title: 'Goods Issue (MIN)',
                        level: 'operate',
                        path: '/inventory/issues',
                        icon: PackageMinus,
                        permissionId: RBAC_PERMISSIONS.INVENTORY_WRITE, // store operations: shown to store staff, not to roles that only read or approve
                    },
                    {
                        title: 'Contractor Material Issue',
                        level: 'operate',
                        path: '/inventory/admin/issue',
                        icon: PackageMinus,
                        permissionId: RBAC_PERMISSIONS.INVENTORY_WRITE, // store operations: shown to store staff, not to roles that only read or approve
                    },
                    {
                        title: 'Contractor Returns',
                        level: 'operate',
                        path: '/inventory/admin/returns',
                        icon: RefreshCw,
                        permissionId: RBAC_PERMISSIONS.INVENTORY_WRITE, // store operations: shown to store staff, not to roles that only read or approve
                    }
                ]
            },
            {
                title: 'Stock & reports',
                path: '#',
                icon: BarChart3,
                level: 'view',
                permissionId: RBAC_PERMISSIONS.INVENTORY_READ,
                submenu: [
                    {
                        title: 'Inventory Health',
                        level: 'view',
                        path: '/inventory/health',
                        icon: TrendingUp,
                        permissionId: RBAC_PERMISSIONS.INVENTORY_READ
                    },
                    {
                        title: 'Inventory Balance',
                        level: 'view',
                        path: '/inventory/stock',
                        icon: BarChart3,
                    },
                    {
                        title: 'Project Material Control',
                        level: 'view',
                        path: '/inventory/project-materials',
                        icon: Package,
                        permissionId: RBAC_PERMISSIONS.INVENTORY_READ
                    },
                    {
                        title: 'Contractor Balance Sheet',
                        level: 'view',
                        path: '/inventory/admin/balance-sheet',
                        icon: ClipboardCheck,
                    },
                    {
                        title: 'Physical Stock Take & Recon', // Merged Material Reconciliation, Contractor Balance Sheet, Material Audit, Inventory Audit
                        level: 'view',
                        path: '/inventory/audit',
                        icon: ShieldCheck,
                    },
                    {
                        title: 'Stock Ledger (Cardex)',
                        level: 'view',
                        path: '/inventory/reports/cardex',
                        icon: HistoryIcon,
                    },
                    {
                        title: 'Material Consumption Report',
                        level: 'view',
                        path: '/inventory/reports/material-summary',
                        icon: BarChart3,
                    }
                ]
            },
            {
                title: 'Receiving & returns',
                path: '#',
                icon: Receipt,
                level: 'operate',
                permissionId: RBAC_PERMISSIONS.INVENTORY_GRN,
                submenu: [
                    {
                        title: 'Goods Receipt (GRN)',
                        level: 'operate',
                        path: '/inventory/grn',
                        icon: Receipt,
                        permissionId: RBAC_PERMISSIONS.INVENTORY_GRN, // store operations: shown to store staff, not to roles that only read or approve
                    },
                    {
                        title: 'Material Returns (MRN)',
                        level: 'operate',
                        path: '/inventory/admin/mrns',
                        icon: RefreshCw,
                        permissionId: RBAC_PERMISSIONS.INVENTORY_GRN, // store operations: shown to store staff, not to roles that only read or approve
                    },
                    {
                        title: 'Inventory Adjustments (Wastage)',
                        level: 'operate',
                        path: '/inventory/admin/wastage',
                        icon: ClipboardCheck,
                        permissionId: RBAC_PERMISSIONS.INVENTORY_ADJUST, // stock adjustments: the Stores Executive and the Stores Manager, not the store officers
                    }
                ]
            },
            {
                title: 'Approvals',
                path: '#',
                icon: ClipboardCheck,
                level: 'approve',
                permissionId: RBAC_PERMISSIONS.INVENTORY_APPROVE,
                submenu: [
                    {
                        title: 'Pending Approvals',
                        level: 'approve',
                        path: '/inventory/approvals',
                        icon: CheckCircle2,
                        permissionId: RBAC_PERMISSIONS.INVENTORY_APPROVE,
                    }
                ]
            },
            {
                title: 'Setup',
                path: '#',
                icon: Warehouse,
                level: 'operate',
                permissionId: RBAC_PERMISSIONS.INVENTORY_MASTER,
                submenu: [
                    {
                        title: 'Item Master Data', // Merged Material Registration + Bulk Import
                        level: 'operate',
                        path: '/inventory/items',
                        icon: FileText,
                        permissionId: RBAC_PERMISSIONS.INVENTORY_MASTER, // the item master: the Executive, the Manager and above, not the officers
                    },
                    {
                        title: 'Opening Stock',
                        level: 'operate',
                        path: '/inventory/admin/initial',
                        icon: BarChart3,
                        permissionId: RBAC_PERMISSIONS.INVENTORY_MASTER, // store operations: shown to store staff, not to roles that only read or approve
                    },
                    {
                        title: 'Virtual Material Swap',
                        level: 'operate',
                        path: '/inventory/admin/virtual-swap',
                        icon: RefreshCw,
                        permissionId: RBAC_PERMISSIONS.INVENTORY_MASTER, // store operations: shown to store staff, not to roles that only read or approve
                    },
                    {
                        title: 'Pre-ERP Legacy Recon',
                        level: 'operate',
                        path: '/inventory/admin/pre-erp-reconciliation',
                        icon: HistoryIcon,
                        permissionId: RBAC_PERMISSIONS.INVENTORY_MASTER, // store operations: shown to store staff, not to roles that only read or approve
                    }
                ]
            }
        ]
    },
    {
        title: 'Approvals',
        path: '/procurement/approvals',
        icon: FileSignature,
        // everyone who approves something here holds this capability (store requests); the OSP Manager steps are the same people
        permissionId: RBAC_PERMISSIONS.INVENTORY_APPROVE,
        submenu: [
            {
                // the store requests waiting for an approver (the page reads /api/inventory/requests)
                title: 'Procurement Approvals',
                path: '/procurement/approvals',
                icon: FileSignature,
                permissionId: RBAC_PERMISSIONS.INVENTORY_APPROVE,
            },
            {
                // vendor payment vouchers: the OSP Account records the signatures and sends the documents, the HO Account Executive receives them
                title: 'Vendor Payment Vouchers',
                path: '/procurement/payment-approvals',
                icon: Receipt,
                permissionId: RBAC_PERMISSIONS.PROCUREMENT_PV_CHAIN_READ,
            },
            {
                // what HO paid on each vendor voucher, from the payments the HO Account Executive records
                title: 'Vendor Payment Status',
                path: '/procurement/vendor-payments',
                icon: Receipt,
                permissionId: RBAC_PERMISSIONS.PROCUREMENT_PV_CHAIN_READ,
            },
            {
                // the invoices Finance sent to the OSP Manager (the OSP Manager holds no Finance menu, so the step lives here)
                title: 'OSP Manager Approvals',
                path: '/invoices/osp-approvals',
                icon: Receipt,
                permissionId: RBAC_PERMISSIONS.INVOICE_OSP_APPROVE,
            },
            {
                // the OSP Manager step of a contractor registration (the Area Manager step is under Service Orders)
                title: 'Contractor Registrations',
                path: '/contractors/management/approvals',
                icon: FileSignature,
                permissionId: RBAC_PERMISSIONS.INVOICE_OSP_APPROVE,
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
                path: '/procurement/purchase-orders',
                icon: FileText,
            },
            {
                title: 'Order Processing',
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
            },
            {
                title: 'Quotations & Award',
                path: '/procurement/quotations',
                icon: FileText,
                permissionId: RBAC_PERMISSIONS.PROCUREMENT_READ
            },
            {
                title: 'Supplier Invoices',
                path: '/procurement/invoices',
                icon: FileText,
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
                        title: 'Finance Control Center',
                        path: '/finance',
                        icon: LayoutDashboard,
                    },
            {
                title: 'Head Office Payments',
                path: '#',
                icon: Send,
                permissionId: 'finance-ops',
                submenu: [
                    {
                        title: 'Payment Vouchers',
                        path: '/finance/payments',
                        icon: Receipt,
                    },
                    {
                        title: 'Payments to Head Office',
                        path: '/finance/ho-payments',
                        icon: Receipt,
                    },
                    {
                        // the same page as under Approvals: the OSP Account Manager and the finance team hold no Approvals menu
                        title: 'Vendor Payment Status',
                        path: '/procurement/vendor-payments',
                        icon: Receipt,
                        permissionId: RBAC_PERMISSIONS.PROCUREMENT_PV_CHAIN_READ,
                    },
                    {
                        title: 'Bulk Payment Run',
                        path: '/finance/ho-run',
                        icon: Receipt,
                    },
                    {
                        title: 'Monthly Payments to HO',
                        path: '/finance/ho-monthly',
                        icon: Receipt,
                    },
                    {
                        title: 'Billing to Head Office',
                        path: '/finance/ho-billing',
                        icon: Receipt,
                    },
                    {
                        title: 'Head Office Funding',
                        path: '/finance/ho-funding',
                        icon: Landmark,
                    },
                    {
                        title: 'Head Office Account',
                        path: '/finance/ho-account',
                        icon: Landmark,
                    },
                    {
                        title: 'Project Head Office Position',
                        path: '/finance/ho-projects',
                        icon: Landmark,
                    }
                ]
            },
            {
                title: 'Petty Cash & OSP Accounts',
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
                    },
                    {
                title: 'Contractor Billing',
                path: '/finance/billing',
                icon: FileText,
            },
                    {
                title: 'Send Invoices to OSP Managers',
                path: '/finance/invoice-dispatch',
                icon: CheckCircle2,
            },
                    {
                title: 'Finance Invoice Approvals',
                path: '/finance/invoices',
                icon: CheckCircle2,
                }
                ]
            },
            {
                title: 'Finance Setup & Registers',
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
                        title: 'Contractor Payment Tiers',
                        path: '/finance/contractor-payments',
                        icon: Calculator,
                        // the tiers are saved through an administrator route
                        permissionId: RBAC_PERMISSIONS.ADMIN_RBAC,
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
                title: 'Vendor Statement',
                path: '/finance/vendor-statement',
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
                        title: 'Bank Statement Auto-Match',
                        path: '/finance/bank-reconciliation',
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
            }
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
                title: 'Period Close',
                path: '#',
                icon: Lock,
                submenu: [
                    {
                title: 'Financial Period Close & Year-End',
                path: '/finance/period-close',
                icon: Lock,
            }
                ]
            }
        ]
    },

    {
        // the cash box of a site office: its custodian and its Area Manager open it without the Finance menu
        title: 'Petty Cash',
        path: '/petty-cash',
        icon: Banknote,
        permissionId: RBAC_PERMISSIONS.PETTY_CASH_SITE,
    },

    {
        title: 'Reports & Analytics',
        path: '/reports',
        icon: FileText,
        module: 'REPORTS',
        submenu: [
            {
                // every report the person may open, with a search and a builder for their own reports
                title: 'Report Center',
                level: 'area',
                path: '/reports',
                icon: FileText,
            },
            
            {
                title: 'Contractor Scorecard',
                level: 'area',
                path: '/contractors/scorecard',
                icon: TrendingUp,
            },
            {
                title: 'Executive Overview',
                level: 'company',
                path: '/reports/manager',
                icon: LayoutDashboard,
            },
            {
                title: 'Area Performance',
                level: 'area',
                path: '/reports/arm',
                icon: Building2,
            },
            {
                title: 'Daily Operational',
                level: 'area',
                path: '/reports/daily-operational',
                icon: FileText,
            }
        ]
    },

    {
        title: 'Vehicle & Fleet Management',
        path: '/fleet/vehicles',
        icon: Car,
        module: 'FLEET',
        submenu: [
            {
                title: 'All Vehicles',
                level: 'view',
                path: '/fleet/vehicles',
                icon: Car,
            },
            {
                title: 'Drivers Directory',
                level: 'view',
                path: '/fleet/drivers',
                icon: Users,
            },
            {
                title: 'Fleet Payments',
                level: 'operate',
                path: '/fleet/payments',
                icon: Banknote,
            },
            {
                title: 'Trip Management',
                level: 'view',
                path: '/fleet/trips',
                icon: Truck,
            },
            {
                title: 'Fleet Reports',
                level: 'view',
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
                // what the system sends by itself, and who receives it
                title: 'Automated Reports & Alerts',
                path: '/admin/settings/automated-notices',
                icon: Mail,
                permissionId: RBAC_PERMISSIONS.ADMIN_RBAC,
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
        module: 'ITMS',
        submenu: [
            {
                title: 'User Portal',
                level: 'view',
                path: '/helpdesk',
                icon: LifeBuoy,
            },
            {
                title: 'New Support Ticket',
                level: 'view',
                path: '/helpdesk/tickets/new',
                icon: FileText,
            },
            {
                title: 'IT Admin Queue',
                level: 'operate',
                path: '/helpdesk/admin',
                icon: ClipboardList,
            },
            {
                title: 'IT Asset Management',
                level: 'operate',
                path: '/helpdesk/assets',
                icon: Laptop,
            },
            {
                title: 'Asset Disposals (Maker-Checker)',
                level: 'operate',
                path: '/helpdesk/disposals',
                icon: Trash2,
            },
            {
                title: 'Asset Depreciation & GL',
                level: 'operate',
                path: '/helpdesk/depreciation',
                icon: Calculator,
            },
            {
                title: 'Live Device Telemetry',
                level: 'operate',
                path: '/helpdesk/telemetry',
                icon: Activity,
            },
            {
                title: 'SLA Breach Monitor',
                level: 'operate',
                path: '/helpdesk/sla-monitor',
                icon: Clock,
            },
            {
                title: 'Physical Asset Audits',
                level: 'approve',
                path: '/helpdesk/assets/audits',
                icon: ClipboardCheck,
            },
            {
                title: 'Software Licenses (SAM)',
                level: 'operate',
                path: '/helpdesk/software-licenses',
                icon: Tag,
            },
            {
                title: 'ITSM Reports & Analytics',
                level: 'operate',
                path: '/helpdesk/reports',
                icon: BarChart3,
            }
        ]
    }
];

export interface MenuAccessOptions {
    /** The person's designations (base role and module designations); with module and level they decide the item by what the person does in the module. */
    designations?: string[];
    module?: MenuModule;
    level?: AccessLevel;
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
    module,
    level,
    isLoggedIn = true,
    itemTitle,
    permissionId,
    userPermissions,
    pathname,
}: MenuAccessOptions) => {
    if (isLoggedIn && !levelAllowsItem(module, level, userPermissions)) return false;
    if (!isLoggedIn) {
        // Only allow public Guest items in sidebar/navigation
        return !!itemTitle && ['IT Help Desk', 'ITMS & IT Help Desk', 'User Dashboard', 'Create Ticket'].includes(itemTitle);
    }

    const canonicalPermission = (permissionId && isCanonicalPermission(permissionId))
        ? permissionId
        : (pathname ? resolvePageCapability(pathname) : undefined) ?? resolveLegacyMenuPermission(permissionId);
    return !!canonicalPermission && !!userPermissions?.includes(canonicalPermission);
};
