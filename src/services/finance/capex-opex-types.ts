// ─────────────────────────────────────────────────────────────────────────────
// CAPEX / OPEX Module — Shared Types, Enums, and Interfaces
// ─────────────────────────────────────────────────────────────────────────────

// ── Expenditure Type ─────────────────────────────────────────────────────────
export const EXPENDITURE_TYPE = {
  CAPEX: 'CAPEX',
  OPEX: 'OPEX',
} as const;
export type ExpenditureType = (typeof EXPENDITURE_TYPE)[keyof typeof EXPENDITURE_TYPE];

// ── Spend Category ────────────────────────────────────────────────────────────
export const SPEND_CATEGORY = {
  NETWORK_INFRA: 'NETWORK_INFRA',
  MAINTENANCE: 'MAINTENANCE',
  CONTRACTOR_PAYMENT: 'CONTRACTOR_PAYMENT',
  PETTY_CASH: 'PETTY_CASH',
  VEHICLE: 'VEHICLE',
  EQUIPMENT: 'EQUIPMENT',
  OTHER: 'OTHER',
} as const;
export type SpendCategory = (typeof SPEND_CATEGORY)[keyof typeof SPEND_CATEGORY];

// ── Source Type (Polymorphic) ─────────────────────────────────────────────────
export const LEDGER_SOURCE_TYPE = {
  PROJECT_EXPENSE: 'PROJECT_EXPENSE',
  INVOICE: 'INVOICE',
  PETTY_CASH: 'PETTY_CASH',
  PURCHASE_ORDER: 'PURCHASE_ORDER',
  VEHICLE_TRIP: 'VEHICLE_TRIP',
  PAYMENT_VOUCHER: 'PAYMENT_VOUCHER',
  MANUAL: 'MANUAL',
} as const;
export type LedgerSourceType = (typeof LEDGER_SOURCE_TYPE)[keyof typeof LEDGER_SOURCE_TYPE];

// ── Budget Status ─────────────────────────────────────────────────────────────
export const BUDGET_STATUS = {
  ACTIVE: 'ACTIVE',
  FROZEN: 'FROZEN',
  REVISED: 'REVISED',
} as const;
export type BudgetStatus = (typeof BUDGET_STATUS)[keyof typeof BUDGET_STATUS];

// ─────────────────────────────────────────────────────────────────────────────
// Auto-Classification Rule Map
// Maps (sourceType + subType) → (expenditureType, category)
// ─────────────────────────────────────────────────────────────────────────────
export const AUTO_CLASSIFICATION_MAP: Record<
  string,
  { expenditureType: ExpenditureType; category: SpendCategory }
> = {
  // Purchase Order types
  PO_MATERIAL: { expenditureType: 'CAPEX', category: 'NETWORK_INFRA' },
  PO_CIVIL: { expenditureType: 'CAPEX', category: 'NETWORK_INFRA' },
  PO_EQUIPMENT: { expenditureType: 'CAPEX', category: 'EQUIPMENT' },
  PO_SERVICE: { expenditureType: 'OPEX', category: 'MAINTENANCE' },
  PO_LABOUR: { expenditureType: 'OPEX', category: 'CONTRACTOR_PAYMENT' },
  PO_OTHER: { expenditureType: 'OPEX', category: 'OTHER' },
  // Expense types
  EXPENSE_EQUIPMENT: { expenditureType: 'CAPEX', category: 'EQUIPMENT' },
  EXPENSE_MATERIAL: { expenditureType: 'CAPEX', category: 'NETWORK_INFRA' },
  EXPENSE_TRANSPORT: { expenditureType: 'OPEX', category: 'VEHICLE' },
  EXPENSE_LABOUR: { expenditureType: 'OPEX', category: 'CONTRACTOR_PAYMENT' },
  EXPENSE_MAINTENANCE: { expenditureType: 'OPEX', category: 'MAINTENANCE' },
  EXPENSE_OTHER: { expenditureType: 'OPEX', category: 'OTHER' },
  // Invoice from SOD
  INVOICE_SOD: { expenditureType: 'OPEX', category: 'CONTRACTOR_PAYMENT' },
  // Petty cash is always OPEX
  PETTY_CASH: { expenditureType: 'OPEX', category: 'PETTY_CASH' },
  // Vehicle trips
  VEHICLE_TRIP: { expenditureType: 'OPEX', category: 'VEHICLE' },
  // Payment vouchers to contractors
  PAYMENT_VOUCHER_CONTRACTOR: { expenditureType: 'OPEX', category: 'CONTRACTOR_PAYMENT' },
  PAYMENT_VOUCHER_VENDOR: { expenditureType: 'CAPEX', category: 'EQUIPMENT' },
};

/**
 * Resolve the expenditure type and category for a given source record.
 * Falls back to OPEX / OTHER if no match found.
 */
export function resolveClassification(
  sourceType: LedgerSourceType,
  subType?: string
): { expenditureType: ExpenditureType; category: SpendCategory } {
  const key = subType ? `${sourceType}_${subType}`.toUpperCase() : sourceType.toUpperCase();
  return (
    AUTO_CLASSIFICATION_MAP[key] ?? { expenditureType: 'OPEX', category: 'OTHER' }
  );
}

/**
 * Compute fiscal year from a date.
 * SLT uses January–December calendar year.
 */
export function getFiscalYear(date: Date): number {
  return date.getFullYear();
}

/**
 * Compute quarter (1-4) from a date.
 */
export function getQuarter(date: Date): number {
  return Math.ceil((date.getMonth() + 1) / 3);
}

// ─────────────────────────────────────────────────────────────────────────────
// DTO Interfaces
// ─────────────────────────────────────────────────────────────────────────────

export interface CreateLedgerEntryInput {
  opmcId: string;
  expenditureType: ExpenditureType;
  category: SpendCategory;
  sourceType: LedgerSourceType;
  sourceId: string;
  amount: number;
  transactionDate?: Date;
  description: string;
  referenceNumber?: string;
  vendorId?: string;
  projectId?: string;
  budgetId?: string;
  createdById: string;
}

export interface CreateBudgetInput {
  opmcId: string;
  fiscalYear: number;
  quarter?: number;
  expenditureType: ExpenditureType;
  category: SpendCategory;
  allocatedAmount: number;
  description?: string;
  createdById: string;
}

export interface UpdateBudgetInput {
  allocatedAmount?: number;
  description?: string;
  status?: BudgetStatus;
  approvedById?: string;
}

export interface BudgetVsActualItem {
  category: SpendCategory;
  expenditureType: ExpenditureType;
  allocated: number;
  actual: number;
  variance: number;
  utilizationPct: number;
  isAlert: boolean;  // >90% utilized
}

export interface CapexOpexSummary {
  capex: {
    budgeted: number;
    actual: number;
    variance: number;
    utilizationPct: number;
  };
  opex: {
    budgeted: number;
    actual: number;
    variance: number;
    utilizationPct: number;
  };
  breakdown: BudgetVsActualItem[];
  alerts: BudgetVsActualItem[];
}

export interface MonthlyTrendPoint {
  month: string;   // "2025-01"
  label: string;   // "Jan 2025"
  capex: number;
  opex: number;
}

export interface LedgerListParams {
  opmcId?: string;
  fiscalYear?: number;
  quarter?: number;
  expenditureType?: ExpenditureType;
  category?: SpendCategory;
  sourceType?: LedgerSourceType;
  page?: number;
  limit?: number;
}

export interface BudgetListParams {
  opmcId?: string;
  fiscalYear?: number;
  expenditureType?: ExpenditureType;
  status?: BudgetStatus;
}
