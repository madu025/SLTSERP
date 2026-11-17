/**
 * Every report the system can produce, in one place (shown by the Report Center at /reports).
 * Visibility is decided by the page capability of each path (page-capabilities.ts) and the user's database
 * grants, never by this list. tests/unit/report-catalog.test.ts fails if a sidebar page that is a report is
 * missing here, so a new report cannot be forgotten.
 */
export type ReportCategory = 'Operations' | 'Finance' | 'Inventory' | 'Procurement' | 'Projects' | 'Fleet' | 'Helpdesk';

export interface ReportCatalogEntry {
    path: string;
    title: string;
    description: string;
    category: ReportCategory;
}

export const REPORT_CATALOG: readonly ReportCatalogEntry[] = [
    { path: '/reports/manager', title: 'Executive Overview', description: 'Completion trend, RTOM and contractor performance, pending approvals.', category: 'Operations' },
    { path: '/reports/arm', title: 'Area Performance', description: 'Performance of each area and RTOM for area managers.', category: 'Operations' },
    { path: '/reports/daily-operational', title: 'Daily Operational Report', description: 'What was received, completed and left open each day.', category: 'Operations' },
    { path: '/service-orders/performance', title: 'SOD Performance & SLA', description: 'Turnaround against the SLA, by RTOM and contractor.', category: 'Operations' },
    { path: '/contractors/scorecard', title: 'Contractor Scorecard', description: 'Delivery, quality and wastage scores for each contractor.', category: 'Operations' },

    { path: '/finance/reports/pnl', title: 'Profit & Loss Statement', description: 'Revenue, expense and net result for a period.', category: 'Finance' },
    { path: '/finance/reports/balance-sheet', title: 'Balance Sheet', description: 'Assets, liabilities and equity at a date.', category: 'Finance' },
    { path: '/finance/reports/cash-flow', title: 'Cash Flow Statement', description: 'Cash in and out by activity.', category: 'Finance' },
    { path: '/finance/reports/trial-balance', title: 'Trial Balance', description: 'Debit and credit balances of every account.', category: 'Finance' },
    { path: '/finance/reports/gl-viewer', title: 'General Ledger Viewer', description: 'Journal lines by account and period.', category: 'Finance' },
    { path: '/finance/reports/profitability', title: 'Profitability', description: 'Margin by project, contractor or area.', category: 'Finance' },
    { path: '/finance/general-ledger', title: 'General Ledger', description: 'Posted entries by account.', category: 'Finance' },
    { path: '/finance/fpa-dashboard', title: 'FP&A Variance Dashboard', description: 'Budget against actual by cost line.', category: 'Finance' },
    { path: '/finance/ar/aging', title: 'AR Aging & Collections', description: 'Receivables by age and customer.', category: 'Finance' },
    { path: '/finance/ap/aging', title: 'AP Aging & Payables', description: 'Payables by age and vendor.', category: 'Finance' },
    { path: '/finance/vendor-statement', title: 'Vendor Statement', description: 'Account statement for one vendor.', category: 'Finance' },
    { path: '/finance/bank/cash-book', title: 'Cash Book & Bank Ledger', description: 'Bank and cash movements.', category: 'Finance' },
    { path: '/finance/osp-account-reports', title: 'OSP Account Reports', description: 'OSP account balances and movements.', category: 'Finance' },
    { path: '/finance/capex-opex', title: 'CAPEX / OPEX Dashboard', description: 'Capital against operating spend.', category: 'Finance' },

    { path: '/inventory/reports/cardex', title: 'Stock Ledger (Cardex)', description: 'Every movement of an item in a store, with running balance.', category: 'Inventory' },
    { path: '/inventory/reports/material-summary', title: 'Material Consumption Report', description: 'Material used by item, contractor and period.', category: 'Inventory' },

    { path: '/procurement/performance', title: 'Procurement Performance', description: 'Lead times, delivery and order cycle performance.', category: 'Procurement' },
    { path: '/procurement/vendors', title: 'Vendor Scorecard', description: 'Vendor delivery and quality ratings.', category: 'Procurement' },

    { path: '/projects/dashboards/pm', title: 'PM Dashboard', description: 'Project schedule and progress for project managers.', category: 'Projects' },
    { path: '/projects/dashboards/financials', title: 'Project Finance Dashboard', description: 'Project budget, cost and invoicing.', category: 'Projects' },
    { path: '/projects/dashboards/qaqc', title: 'QA/QC Dashboard', description: 'Quality checks and defects.', category: 'Projects' },
    { path: '/projects/dashboards/logistics', title: 'Logistics Dashboard', description: 'Material supply and delivery for projects.', category: 'Projects' },

    { path: '/reports/fleet', title: 'Fleet Reports', description: 'Vehicle usage, trips and fleet costs.', category: 'Fleet' },
    { path: '/helpdesk/reports', title: 'ITSM Reports & Analytics', description: 'Tickets, resolution times and assets.', category: 'Helpdesk' },
];
