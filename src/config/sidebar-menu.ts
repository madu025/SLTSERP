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


import { ROLE_GROUPS } from "@/config/roles";

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
        title: 'Contractor Field Portal',
        path: '/contractor/dashboard',
        icon: Truck,
        allowedRoles: ['CONTRACTOR_SUPERVISOR', 'CONTRACTOR_TECHNICIAN', 'CONTRACTOR_FINANCE'],
        permissionId: 'contractor-portal',
        submenu: [
            {
                title: 'Overview',
                path: '/contractor/dashboard',
                icon: LayoutDashboard,
                allowedRoles: ['CONTRACTOR_SUPERVISOR', 'CONTRACTOR_TECHNICIAN', 'CONTRACTOR_FINANCE']
            },
            {
                title: 'My In-Hand Stock',
                path: '/contractor/inventory',
                icon: Package,
                allowedRoles: ['CONTRACTOR_SUPERVISOR', 'CONTRACTOR_TECHNICIAN', 'CONTRACTOR_FINANCE']
            },
            {
                title: 'Field SODs',
                path: '/contractor/sods',
                icon: ClipboardList,
                allowedRoles: ['CONTRACTOR_SUPERVISOR', 'CONTRACTOR_TECHNICIAN', 'CONTRACTOR_FINANCE']
            },
            {
                title: 'Claims & Payments',
                path: '/contractor/finance',
                icon: Banknote,
                allowedRoles: ['CONTRACTOR_SUPERVISOR', 'CONTRACTOR_TECHNICIAN', 'CONTRACTOR_FINANCE']
            }
        ]
    },
    {
        title: 'Dashboard',
        path: '/dashboard',
        icon: LayoutDashboard,
        allowedRoles: [
            'SUPER_ADMIN', 'ADMIN', 'CEO', 'HEAD_OF_OSP', 'MANAGER', 'OSP_MANAGER', 'AREA_MANAGER', 
            'ENGINEER', 'ASSISTANT_ENGINEER', 'AREA_COORDINATOR', 'QC_OFFICER', 
            'FINANCE_MANAGER', 'FINANCE_ASSISTANT',
            'STORES_MANAGER', 'STORES_ASSISTANT',
            'INVOICE_MANAGER', 'INVOICE_ASSISTANT', 'AR_OFFICER',
            'SF_AUDIT_MANAGER', 'SF_AUDIT_OFFICER', 'RATE_AUDITOR',
            'PROCUREMENT_OFFICER', 'OFFICE_ADMIN', 'OFFICE_ADMIN_ASSISTANT', 'SITE_OFFICE_STAFF',
            'SA_MANAGER', 'SA_ASSISTANT', 'HEAD_OF_SECTION'
        ],
        permissionId: 'dashboard'
    },
    {
        title: 'Service Orders',
        path: '/service-orders/work-order',
        icon: FileText,
        // Service Orders are main work for New Connection & Ops
        allowedRoles: ROLE_GROUPS.ALL_OPS,
        permissionId: 'service-orders',
        submenu: [
            {
                title: 'Pending SOD',
                path: '/service-orders/work-order',
                icon: FileText,
                allowedRoles: ROLE_GROUPS.ALL_OPS
            },
            {
                title: 'Install Closed SOD',
                path: '/service-orders/work-order/install-closed',
                icon: CheckCircle2,
                allowedRoles: ROLE_GROUPS.ALL_OPS
            },
            {
                title: 'Return SOD',
                path: '/service-orders/work-order/return',
                icon: FileText,
                allowedRoles: ROLE_GROUPS.ALL_OPS
            },
            {
                title: 'Disappeared SODs',
                path: '/service-orders/work-order/disappeared',
                icon: EyeOff,
                allowedRoles: ROLE_GROUPS.ALL_OPS
            },
            {
                title: 'Completed SOD',
                path: '/service-orders/work-order/completed',
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
                path: '/service-orders/work-order/pat',
                icon: ClipboardCheck,
                allowedRoles: ROLE_GROUPS.ALL_OPS
            },
            {
                title: 'Offline Work Orders',
                path: '/service-orders/work-order/offline-work-orders',
                icon: Tag,
                allowedRoles: ROLE_GROUPS.ALL_OPS
            }
        ]
    },
    {
        title: 'Contractors',
        path: '/contractors/management',
        icon: HardHat,
        allowedRoles: [...ROLE_GROUPS.OSP_PROJECTS, ...ROLE_GROUPS.NEW_CONNECTION, ...ROLE_GROUPS.OFFICE_ADMINS],
        permissionId: 'contractors',
        submenu: [
            {
                title: 'All Contractors',
                path: '/contractors/management',
                icon: HardHat,
                allowedRoles: [...ROLE_GROUPS.OSP_PROJECTS, ...ROLE_GROUPS.NEW_CONNECTION, ...ROLE_GROUPS.OFFICE_ADMINS]
            },
            {
                title: 'Bulk Import',
                path: '/contractors/management/import',
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
        title: 'Finance Setup & Ops',
        path: '/finance/setup',
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
                path: '/finance/vendors',
                icon: Building,
                allowedRoles: [...ROLE_GROUPS.ADMINS, ...ROLE_GROUPS.FINANCE]
            },
            {
                title: 'Bank Registry',
                path: '/finance/banks',
                icon: Landmark,
                allowedRoles: [...ROLE_GROUPS.ADMINS, ...ROLE_GROUPS.FINANCE]
            },
            {
                title: 'Payment Vouchers',
                path: '/finance/payments',
                icon: Receipt,
                allowedRoles: [...ROLE_GROUPS.ADMINS, ...ROLE_GROUPS.FINANCE]
            },
            {
                title: 'Petty Cash',
                path: '/finance/petty-cash',
                icon: Banknote,
                allowedRoles: [...ROLE_GROUPS.ADMINS, ...ROLE_GROUPS.FINANCE, ...ROLE_GROUPS.OFFICE_ADMINS]
            },
            {
                title: 'Retention Management',
                path: '/finance/retention',
                icon: Shield,
                allowedRoles: [...ROLE_GROUPS.ADMINS, ...ROLE_GROUPS.FINANCE]
            },
            {
                title: 'LD Penalties',
                path: '/finance/ld-penalties',
                icon: ShieldAlert,
                allowedRoles: [...ROLE_GROUPS.ADMINS, ...ROLE_GROUPS.FINANCE]
            },
            {
                title: 'Rate Matrix Config',
                path: '/finance/rate-matrix',
                icon: Calculator,
                allowedRoles: [...ROLE_GROUPS.ADMINS, ...ROLE_GROUPS.FINANCE, 'OSP_MANAGER']
            },
            {
                title: 'CAPEX / OPEX Dashboard',
                path: '/finance/capex-opex',
                icon: TrendingUp,
                allowedRoles: [...ROLE_GROUPS.ADMINS, ...ROLE_GROUPS.FINANCE, 'OSP_MANAGER', 'AREA_MANAGER']
            },
            {
                title: 'WIP Revenue & Billing Pipeline',
                path: '/finance/wip-revenue',
                icon: TrendingUp,
                allowedRoles: [...ROLE_GROUPS.ADMINS, ...ROLE_GROUPS.FINANCE, 'OSP_MANAGER']
            },
            {
                title: 'Budget Allocations',
                path: '/finance/budget',
                icon: PieChart,
                allowedRoles: [...ROLE_GROUPS.ADMINS, ...ROLE_GROUPS.FINANCE]
            },
            {
                title: 'Vendor Upload (HO)',
                path: '/finance/vendors/import',
                icon: Upload,
                allowedRoles: ROLE_GROUPS.ADMINS
            },
            {
                title: 'Bank Upload (HO)',
                path: '/finance/banks/import',
                icon: Upload,
                allowedRoles: ROLE_GROUPS.ADMINS
            }
        ]
    },

    {
        title: 'SF Audit Division',
        path: '/finance/sf-audit/governance',
        icon: ShieldCheck,
        allowedRoles: [...ROLE_GROUPS.ADMINS, ...ROLE_GROUPS.FINANCE, ...ROLE_GROUPS.ALL_OPS, ...ROLE_GROUPS.SF_AUDITING],
        permissionId: 'sf-audit',
        submenu: [
            {
                title: 'SF Audit Governance',
                path: '/finance/sf-audit/governance',
                icon: ShieldCheck,
                allowedRoles: [...ROLE_GROUPS.ADMINS, ...ROLE_GROUPS.FINANCE, ...ROLE_GROUPS.SF_AUDITING]
            },
            {
                title: 'Contractor Invoice Pricing Audit',
                path: '/finance/sf-audit/pricing-audit',
                icon: Calculator,
                allowedRoles: [...ROLE_GROUPS.ADMINS, ...ROLE_GROUPS.FINANCE, ...ROLE_GROUPS.SF_AUDITING]
            },
            {
                title: 'Header & Material Mapping Config',
                path: '/finance/sf-audit/header-mapping',
                icon: Settings,
                allowedRoles: [...ROLE_GROUPS.ADMINS, ...ROLE_GROUPS.FINANCE, ...ROLE_GROUPS.ALL_OPS, ...ROLE_GROUPS.SF_AUDITING]
            },
            {
                title: 'Payment Split Rules Configurator',
                path: '/finance/sf-audit/payment-split-config',
                icon: Calculator,
                allowedRoles: [...ROLE_GROUPS.ADMINS, ...ROLE_GROUPS.FINANCE, ...ROLE_GROUPS.ALL_OPS, ...ROLE_GROUPS.SF_AUDITING]
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
                path: '/finance/cost-allocation',
                icon: FileSignature,
                allowedRoles: [...ROLE_GROUPS.ADMINS, ...ROLE_GROUPS.FINANCE, 'OSP_MANAGER']
            },
            {
                title: 'SOD Revenue Config',
                path: '/finance/sod-revenue',
                icon: Receipt,
                allowedRoles: ROLE_GROUPS.ADMINS
            }
        ]
    },

    {
        title: 'Central Finance',
        path: '/finance',
        icon: Receipt,
        allowedRoles: [...ROLE_GROUPS.ADMINS, ...ROLE_GROUPS.FINANCE],
        permissionId: 'finance',
        submenu: [
            {
                title: 'General Ledger',
                path: '/finance/general-ledger',
                icon: Receipt,
                allowedRoles: ['SUPER_ADMIN', 'ADMIN', 'FINANCE_MANAGER']
            }
        ]
    },

    {
        title: 'OSP Accounts',
        path: '/finance/osp-account',
        icon: Receipt,
        allowedRoles: [...ROLE_GROUPS.ADMINS, ...ROLE_GROUPS.FINANCE, 'OSP_MANAGER'],
        permissionId: 'finance',
        submenu: [
            {
                title: 'OSP Dashboard',
                path: '/finance/osp-account-reports',
                icon: Receipt,
                allowedRoles: ['SUPER_ADMIN', 'ADMIN', 'FINANCE_MANAGER', 'OSP_MANAGER']
            },
            {
                title: 'Petty Cash IOUs',
                path: '/finance/osp-account/ious',
                icon: Receipt,
                allowedRoles: ['SUPER_ADMIN', 'ADMIN', 'FINANCE_MANAGER', 'OSP_MANAGER']
            },
            {
                title: 'Project Advances',
                path: '/finance/osp-account/advances',
                icon: Receipt,
                allowedRoles: ['SUPER_ADMIN', 'ADMIN', 'FINANCE_MANAGER', 'OSP_MANAGER']
            },
            {
                title: 'Property Rents',
                path: '/finance/osp-account/rents',
                icon: Receipt,
                allowedRoles: ['SUPER_ADMIN', 'ADMIN', 'FINANCE_MANAGER', 'OSP_MANAGER']
            },
            {
                title: 'Fleet Ledger',
                path: '/finance/osp-account/fleet',
                icon: Receipt,
                allowedRoles: ['SUPER_ADMIN', 'ADMIN', 'FINANCE_MANAGER', 'OSP_MANAGER']
            }
        ]
    },

    {
        title: 'Inventory / Stores',
        path: '/inventory',
        icon: Warehouse,
        // SECTION_HEADS see the section but only the Cardex report item below
        allowedRoles: [...ROLE_GROUPS.STORES, 'OSP_MANAGER', 'AREA_MANAGER', ...ROLE_GROUPS.SECTION_HEADS],
        permissionId: 'inventory',
        submenu: [
            {
                title: 'Dashboard Overview',
                path: '/inventory',
                icon: LayoutDashboard,
                allowedRoles: [...ROLE_GROUPS.STORES, 'OSP_MANAGER', 'AREA_MANAGER']
            },
            // 1. Setup & Master Data
            {
                title: 'Item Master Data', // Merged Material Registration + Bulk Import
                path: '/inventory/items',
                icon: FileText,
                allowedRoles: ['SUPER_ADMIN', 'ADMIN', 'STORES_MANAGER']
            },
            // 2. Stock Inflow
            {
                title: 'Goods Receipt (GRN)',
                path: '/inventory/grn',
                icon: Receipt,
                allowedRoles: ['SUPER_ADMIN', 'ADMIN', 'STORES_MANAGER', 'STORES_ASSISTANT', 'PROCUREMENT_OFFICER']
            },
            {
                // Single Unified Hub: Stock Requests + Material Requests + Approvals
                title: 'Material Requisitions',
                path: '/inventory/requests',
                icon: ClipboardList,
                allowedRoles: ['SUPER_ADMIN', 'ADMIN', 'STORES_MANAGER', 'STORES_ASSISTANT', 'OSP_MANAGER', 'AREA_MANAGER', 'ENGINEER']
            },
            // 3. Stock Outflow
            {
                title: 'Inventory Balance',
                path: '/inventory/stock',
                icon: BarChart3,
                allowedRoles: ROLE_GROUPS.STORES
            },
            {
                title: 'Goods Issue (MIN)',
                path: '/inventory/issues',
                icon: PackageMinus,
                allowedRoles: ['SUPER_ADMIN', 'ADMIN', 'STORES_MANAGER', 'STORES_ASSISTANT']
            },
            {
                title: 'Office Assets (EAM)',
                path: '/eam/assets',
                icon: HardHat,
                allowedRoles: ROLE_GROUPS.EAM_ASSET_MANAGERS
            },
            {
                title: 'Inventory Adjustments (Wastage)',
                path: '/inventory/admin/wastage',
                icon: ClipboardCheck,
                allowedRoles: ['SUPER_ADMIN', 'ADMIN', 'STORES_MANAGER', 'OSP_MANAGER']
            },
            // 4. Returns & Reconciliation
            {
                title: 'Material Returns (MRN)',
                path: '/inventory/admin/mrns',
                icon: RefreshCw,
                allowedRoles: ['SUPER_ADMIN', 'ADMIN', 'STORES_MANAGER', 'STORES_ASSISTANT']
            },
            {
                title: 'Physical Stock Take & Recon', // Merged Material Reconciliation, Contractor Balance Sheet, Material Audit, Inventory Audit
                path: '/inventory/audit',
                icon: ShieldCheck,
                allowedRoles: ['SUPER_ADMIN', 'ADMIN', 'STORES_MANAGER', 'OSP_MANAGER', 'FINANCE_MANAGER']
            },
            // 5. Analytics & History
            {
                title: 'Stock Ledger (Cardex)',
                path: '/inventory/reports/cardex',
                icon: HistoryIcon,
                allowedRoles: ['SUPER_ADMIN', 'ADMIN', 'STORES_MANAGER', 'STORES_ASSISTANT', ...ROLE_GROUPS.SECTION_HEADS]
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
                title: 'Material Requests & Approvals',
                path: '/inventory/requests',
                icon: ClipboardList,
                allowedRoles: ['SUPER_ADMIN', 'ADMIN', 'STORES_MANAGER', 'OSP_MANAGER', 'AREA_MANAGER', 'ENGINEER']
            },
            {
                title: 'Procurement Approvals',
                path: '/procurement/approvals',
                icon: FileSignature,
                allowedRoles: ['SUPER_ADMIN', 'ADMIN', 'OSP_MANAGER', 'MANAGER', 'PROCUREMENT_OFFICER']
            },
            {
                title: 'Contractor Registration Approvals',
                path: '/contractors/management/approvals',
                icon: FileSignature,
                allowedRoles: ROLE_GROUPS.ALL_OPS
            }
        ]
    },
    {
        title: 'Procurement',
        path: '/procurement',
        icon: ShoppingCart,
        allowedRoles: [...ROLE_GROUPS.PROCUREMENT],
        permissionId: 'procurement',
        submenu: [
            {
                title: 'Overview',
                path: '/procurement',
                icon: LayoutDashboard,
                allowedRoles: [...ROLE_GROUPS.PROCUREMENT]
            },
            {
                title: 'Purchase Orders',
                path: '/procurement/orders',
                icon: FileText,
                allowedRoles: [...ROLE_GROUPS.PROCUREMENT]
            },
            {
                title: 'AI Forecast & PO Builder',
                path: '/procurement/forecast',
                icon: FileText,
                allowedRoles: [...ROLE_GROUPS.PROCUREMENT]
            }
        ]
    },
    {
        title: 'Corporate Finance & Accounts',
        path: '/finance/chart-of-accounts',
        icon: Landmark,
        allowedRoles: ROLE_GROUPS.FINANCE,
        permissionId: 'finance',
        submenu: [
            {
                title: 'FP&A Variance Dashboard',
                path: '/finance/fpa-dashboard',
                icon: Activity,
                allowedRoles: ROLE_GROUPS.FINANCE
            },
            {
                title: 'Auto Bank Reconciliation',
                path: '/finance/bank-reconciliation',
                icon: CheckCircle2,
                allowedRoles: ROLE_GROUPS.FINANCE
            },
            {
                title: 'Multi-Currency FX Rates',
                path: '/finance/exchange-rates',
                icon: Globe,
                allowedRoles: ROLE_GROUPS.FINANCE
            },
            {
                title: 'Chart of Accounts',
                path: '/finance/chart-of-accounts',
                icon: List,
                allowedRoles: ROLE_GROUPS.FINANCE
            },
            {
                title: 'Trial Balance',
                path: '/finance/reports/trial-balance',
                icon: Scale,
                allowedRoles: ROLE_GROUPS.FINANCE
            },
            {
                title: 'Profit & Loss Statement',
                path: '/finance/reports/pnl',
                icon: TrendingUp,
                allowedRoles: ROLE_GROUPS.FINANCE
            },
            {
                title: 'Balance Sheet',
                path: '/finance/reports/balance-sheet',
                icon: Landmark,
                allowedRoles: ROLE_GROUPS.FINANCE
            },
            {
                title: 'GL Ledger Viewer',
                path: '/finance/reports/gl-viewer',
                icon: Layers,
                allowedRoles: ROLE_GROUPS.FINANCE
            },
            {
                title: 'VAT Return & Tax Register',
                path: '/finance/tax/vat-return',
                icon: Receipt,
                allowedRoles: ROLE_GROUPS.FINANCE
            },
            {
                title: 'WHT Certificates & Register',
                path: '/finance/tax/wht-register',
                icon: FileCheck2,
                allowedRoles: ROLE_GROUPS.FINANCE
            },
            {
                title: 'AR Aging & Collections',
                path: '/finance/ar/aging',
                icon: Users,
                allowedRoles: ROLE_GROUPS.FINANCE
            },
            {
                title: 'AP Aging & Payables',
                path: '/finance/ap/aging',
                icon: Building2,
                allowedRoles: ROLE_GROUPS.FINANCE
            },
            {
                title: 'Cash Book & Bank Ledger',
                path: '/finance/bank/cash-book',
                icon: Landmark,
                allowedRoles: ROLE_GROUPS.FINANCE
            },
            {
                title: 'Bank Statement Reconciliation',
                path: '/finance/bank/reconciliation',
                icon: CheckCircle2,
                allowedRoles: ROLE_GROUPS.FINANCE
            },
            {
                title: 'Fixed Asset Register & Depreciation',
                path: '/finance/fixed-assets',
                icon: Package,
                allowedRoles: ROLE_GROUPS.FINANCE
            },
            {
                title: 'HO Payroll Expense Allocation',
                path: '/finance/payroll',
                icon: Users,
                allowedRoles: ROLE_GROUPS.FINANCE
            },
            {
                title: 'Financial Period Close & Year-End',
                path: '/finance/period-close',
                icon: Lock,
                allowedRoles: ROLE_GROUPS.FINANCE
            },
            {
                title: 'Credit & Debit Notes',
                path: '/finance/credit-notes',
                icon: FileText,
                allowedRoles: ROLE_GROUPS.FINANCE
            },
            {
                title: 'Contractor Billing',
                path: '/finance/billing',
                icon: FileText,
                allowedRoles: ['SUPER_ADMIN', 'FINANCE_MANAGER', 'OSP_MANAGER']
            },
            {
                title: 'Invoice Approvals',
                path: '/finance/invoices',
                icon: CheckCircle2,
                allowedRoles: ['SUPER_ADMIN', 'FINANCE_MANAGER']
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
                allowedRoles: ['SUPER_ADMIN', 'ADMIN', 'OSP_MANAGER', 'MANAGER', ...ROLE_GROUPS.SECTION_HEADS]
            },
            {
                title: 'Area Performance',
                path: '/reports/arm',
                icon: Building2,
                allowedRoles: ['SUPER_ADMIN', 'ADMIN', 'OSP_MANAGER', 'MANAGER', 'AREA_MANAGER', ...ROLE_GROUPS.SECTION_HEADS]
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
                allowedRoles: ['SUPER_ADMIN', 'ADMIN', 'OSP_MANAGER', 'MANAGER', 'AREA_MANAGER', ...ROLE_GROUPS.SECTION_HEADS]
            }
        ]
    },

    {
        title: 'Vehicle & Fleet Management',
        path: '/fleet/vehicles',
        icon: Car,
        allowedRoles: [...ROLE_GROUPS.ADMINS, 'OFFICE_ADMIN', 'OFFICE_ADMIN_ASSISTANT'],
        permissionId: 'administration',
        submenu: [
            {
                title: 'All Vehicles',
                path: '/fleet/vehicles',
                icon: Car,
                allowedRoles: [...ROLE_GROUPS.ADMINS, 'OFFICE_ADMIN', 'OFFICE_ADMIN_ASSISTANT']
            },
            {
                title: 'Drivers Directory',
                path: '/fleet/drivers',
                icon: Users,
                allowedRoles: [...ROLE_GROUPS.ADMINS, 'OFFICE_ADMIN', 'OFFICE_ADMIN_ASSISTANT']
            },
            {
                title: 'Fleet Payments',
                path: '/fleet/payments',
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
                title: 'User Guide & Docs',
                path: '/admin/guide',
                icon: FileText,
                allowedRoles: ROLE_GROUPS.ADMINS
            },
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
                title: 'Section Role Permissions',
                path: '/admin/roles',
                icon: ShieldCheck,
                allowedRoles: ROLE_GROUPS.ADMINS
            },
            {
                title: 'Department Sections',
                path: '/admin/sections',
                icon: Layers,
                allowedRoles: ROLE_GROUPS.ADMINS
            },
            {
                title: 'Staff Hierarchy Master',
                path: '/admin/staff',
                icon: Users,
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
                path: '/projects/opmcs',
                icon: Building2,
                allowedRoles: ROLE_GROUPS.ADMINS
            },
            {
                title: 'Store Management',
                path: '/inventory/stores',
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
                title: 'Process Gates Engine',
                path: '/admin/settings/process-gates',
                icon: ShieldCheck,
                allowedRoles: ROLE_GROUPS.ADMINS
            },
            {
                title: 'SMTP Email Config',
                path: '/admin/settings/smtp',
                icon: Mail,
                allowedRoles: ROLE_GROUPS.ADMINS
            },
            {
                title: 'SOD Import',
                path: '/service-orders/import',
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
    },
    {
        title: 'IT Help Desk & Assets',
        path: '/helpdesk',
        icon: LifeBuoy,
        allowedRoles: ['ALL'],
        submenu: [
            {
                title: 'User Portal',
                path: '/helpdesk',
                icon: LifeBuoy,
                allowedRoles: ['ALL']
            },
            {
                title: 'New Support Ticket',
                path: '/helpdesk/tickets/new',
                icon: FileText,
                allowedRoles: ['ALL']
            },
            {
                title: 'IT Admin Queue',
                path: '/helpdesk/admin',
                icon: ClipboardList,
                allowedRoles: [...ROLE_GROUPS.OFFICE_ADMINS, 'ENGINEER']
            },
            {
                title: 'IT Asset Management',
                path: '/helpdesk/assets',
                icon: Laptop,
                allowedRoles: [...ROLE_GROUPS.OFFICE_ADMINS, 'ENGINEER']
            },
            {
                title: 'Asset Disposals (Maker-Checker)',
                path: '/helpdesk/disposals',
                icon: Trash2,
                allowedRoles: [...ROLE_GROUPS.OFFICE_ADMINS, 'FINANCE_MANAGER', 'ENGINEER']
            },
            {
                title: 'Asset Depreciation & GL',
                path: '/helpdesk/depreciation',
                icon: Calculator,
                allowedRoles: [...ROLE_GROUPS.OFFICE_ADMINS, 'FINANCE_MANAGER', 'ENGINEER']
            },
            {
                title: 'Live Device Telemetry',
                path: '/helpdesk/telemetry',
                icon: Activity,
                allowedRoles: [...ROLE_GROUPS.OFFICE_ADMINS, 'ENGINEER']
            },
            {
                title: 'SLA Breach Monitor',
                path: '/helpdesk/sla-monitor',
                icon: Clock,
                allowedRoles: [...ROLE_GROUPS.OFFICE_ADMINS, 'ENGINEER']
            },
            {
                title: 'Physical Asset Audits',
                path: '/helpdesk/assets/audits',
                icon: ClipboardCheck,
                allowedRoles: [...ROLE_GROUPS.OFFICE_ADMINS, 'ENGINEER']
            },
            {
                title: 'Software Licenses (SAM)',
                path: '/helpdesk/software-licenses',
                icon: Tag,
                allowedRoles: [...ROLE_GROUPS.OFFICE_ADMINS, 'ENGINEER']
            },
            {
                title: 'ITSM Reports & Analytics',
                path: '/helpdesk/reports',
                icon: BarChart3,
                allowedRoles: [...ROLE_GROUPS.OFFICE_ADMINS, 'ENGINEER']
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
    
    // Strict isolation for Contractor Roles: ONLY allow items where role is explicitly listed
    if (userRole.startsWith('CONTRACTOR_')) {
        return allowedRoles.includes(userRole);
    }

    // Strict isolation for Procurement Officer: ONLY allow items where role is explicitly listed
    if (userRole === 'PROCUREMENT_OFFICER') {
        return allowedRoles.includes(userRole);
    }

    // Check if user role is explicitly allowed
    if (allowedRoles.includes('ALL') || allowedRoles.includes(userRole)) return true;

    // If dynamic permissions explicitly match, allow
    if (userPermissions && permissionId && userPermissions.includes(permissionId)) {
        return true;
    }

    return false;
};
