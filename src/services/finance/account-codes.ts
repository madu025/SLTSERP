/**
 * Chart of Accounts - Single Source of Truth
 * -------------------------------------------
 * Every finance posting in the ERP MUST reference an account code from this module.
 * `ACCOUNTS` provides semantic aliases so services never hard-code raw code strings,
 * and `CHART_OF_ACCOUNTS` is the canonical master list consumed by the CoA seed and
 * by the ledger gateway for account validation.
 *
 * If you need a new account, add it here (and only here) so the seed, the gateway
 * validation, and the reporting layer all stay reconciled automatically.
 */

export type AccountTypeName = 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';

export interface ChartOfAccountEntry {
    code: string;
    name: string;
    type: AccountTypeName;
    isPostable: boolean;
}

/**
 * Semantic account aliases. Use these constants everywhere instead of raw code strings.
 */
export const ACCOUNTS = {
    // ASSETS (1000 Series)
    BANK: 'BANK-1000',
    INVENTORY: 'INV-1010',
    PETTY_CASH: 'PETTY-1020',
    AR_CLIENT: 'AR-1110',
    WHT_RECEIVABLE: 'WHT-REC-1300',
    FIXED_ASSETS: 'FA-1500',
    ACCUM_DEPRECIATION: 'ACCUM-DEP-1590',

    // LIABILITIES (2000 Series)
    AP_ACCRUED: 'AP-2010',
    AP_VENDOR: 'AP-VEND-2010',
    AP_CONTRACTOR: 'AP-CON-2020',
    VAT_PAYABLE: 'VAT-PAY-2110',
    SSCL_PAYABLE: 'SSCL-PAY-2115',
    WHT_PAYABLE: 'WHT-PAY-2120',
    RETENTION_PAYABLE: 'RET-PAY-2130',
    HO_CLEARING: 'HO-CLEARING-2500',
    HO_CLEARING_LEGACY: 'CLR-HO-9010',

    // EQUITY (3000 Series)
    RETAINED_EARNINGS: 'EQUITY-3000',

    // REVENUE (4000 Series)
    REVENUE: 'REV-4010',
    LD_INCOME: 'LD-INC-4200',

    // EXPENSES & COGS (5000 / 6000 / 8000 Series)
    COGS: 'COGS-5010',
    SUBCONTRACTOR: 'SUB-5020',
    CONTRACTOR_EXPENSE: 'EXP-CON-4020',
    WASTAGE_EXPENSE: 'EXP-WASTAGE-5030',
    STAFF_EXPENSE: 'EXP-STAFF-6010',
    VEHICLE_EXPENSE: 'EXP-VEHICLE-6020',
    DEPRECIATION_EXPENSE: 'EXP-DEP-6030',
    PETTY_CASH_EXPENSE: 'EXP-PETTY-6040',
    OSP_EXPENSE: 'EXP-OSP-8010',
} as const;

export type AccountCode = (typeof ACCOUNTS)[keyof typeof ACCOUNTS];

/**
 * Canonical Chart of Accounts master list. This is the ONLY definition of valid accounts.
 */
export const CHART_OF_ACCOUNTS: ChartOfAccountEntry[] = [
    // ASSETS (1000 Series)
    { code: ACCOUNTS.BANK, name: 'Main Bank Account', type: 'ASSET', isPostable: true },
    { code: ACCOUNTS.INVENTORY, name: 'Raw Material Inventory', type: 'ASSET', isPostable: true },
    { code: ACCOUNTS.PETTY_CASH, name: 'Petty Cash Imprest Account', type: 'ASSET', isPostable: true },
    { code: ACCOUNTS.AR_CLIENT, name: 'Accounts Receivable - Client', type: 'ASSET', isPostable: true },
    { code: ACCOUNTS.WHT_RECEIVABLE, name: 'Withholding Tax (WHT) Receivable', type: 'ASSET', isPostable: true },
    { code: ACCOUNTS.FIXED_ASSETS, name: 'Fixed Assets - Machinery & Equipment', type: 'ASSET', isPostable: true },
    { code: ACCOUNTS.ACCUM_DEPRECIATION, name: 'Accumulated Depreciation - Fixed Assets', type: 'ASSET', isPostable: true },

    // LIABILITIES (2000 Series)
    { code: ACCOUNTS.AP_ACCRUED, name: 'Accrued Accounts Payable', type: 'LIABILITY', isPostable: true },
    { code: ACCOUNTS.AP_VENDOR, name: 'Trade Accounts Payable - Vendors', type: 'LIABILITY', isPostable: true },
    { code: ACCOUNTS.AP_CONTRACTOR, name: 'Accrued Contractor Payable', type: 'LIABILITY', isPostable: true },
    { code: ACCOUNTS.VAT_PAYABLE, name: 'Output VAT Payable', type: 'LIABILITY', isPostable: true },
    { code: ACCOUNTS.SSCL_PAYABLE, name: 'SSCL Payable', type: 'LIABILITY', isPostable: true },
    { code: ACCOUNTS.WHT_PAYABLE, name: 'Withholding Tax (WHT) Payable', type: 'LIABILITY', isPostable: true },
    { code: ACCOUNTS.RETENTION_PAYABLE, name: 'Contractor Retention Payable', type: 'LIABILITY', isPostable: true },
    { code: ACCOUNTS.HO_CLEARING, name: 'Head Office Inter-Company Clearing Account', type: 'LIABILITY', isPostable: true },
    { code: ACCOUNTS.HO_CLEARING_LEGACY, name: 'Head Office Clearing Account (Legacy)', type: 'LIABILITY', isPostable: true },

    // EQUITY (3000 Series)
    { code: ACCOUNTS.RETAINED_EARNINGS, name: 'Retained Earnings', type: 'EQUITY', isPostable: true },

    // REVENUE (4000 Series)
    { code: ACCOUNTS.REVENUE, name: 'Accrued Project & Service Revenue', type: 'REVENUE', isPostable: true },
    { code: ACCOUNTS.LD_INCOME, name: 'Liquidated Damages & Penalties Income', type: 'REVENUE', isPostable: true },

    // EXPENSES & COGS (5000 / 6000 / 8000 Series)
    { code: ACCOUNTS.COGS, name: 'Cost of Goods Sold - Materials Installed', type: 'EXPENSE', isPostable: true },
    { code: ACCOUNTS.SUBCONTRACTOR, name: 'Subcontractor & SOD Labor Cost', type: 'EXPENSE', isPostable: true },
    { code: ACCOUNTS.CONTRACTOR_EXPENSE, name: 'Contractor Work Cost', type: 'EXPENSE', isPostable: true },
    { code: ACCOUNTS.WASTAGE_EXPENSE, name: 'Material Wastage & Scrap Expense', type: 'EXPENSE', isPostable: true },
    { code: ACCOUNTS.STAFF_EXPENSE, name: 'Allocated Payroll & Staff Expenses', type: 'EXPENSE', isPostable: true },
    { code: ACCOUNTS.VEHICLE_EXPENSE, name: 'Vehicle Running & Maintenance Cost', type: 'EXPENSE', isPostable: true },
    { code: ACCOUNTS.DEPRECIATION_EXPENSE, name: 'Depreciation Expense', type: 'EXPENSE', isPostable: true },
    { code: ACCOUNTS.PETTY_CASH_EXPENSE, name: 'General & Administrative Petty Cash Expenses', type: 'EXPENSE', isPostable: true },
    { code: ACCOUNTS.OSP_EXPENSE, name: 'OSP Direct Expense (Legacy)', type: 'EXPENSE', isPostable: true },
];

/** Set of all valid account codes for O(1) validation. */
export const VALID_ACCOUNT_CODES: ReadonlySet<string> = new Set(CHART_OF_ACCOUNTS.map((a) => a.code));

/** Set of postable account codes (codes that transactions may post directly against). */
export const POSTABLE_ACCOUNT_CODES: ReadonlySet<string> = new Set(
    CHART_OF_ACCOUNTS.filter((a) => a.isPostable).map((a) => a.code)
);
