import { prisma } from '@/lib/prisma';
import type { FinanceBudgetAllocation } from '@prisma/client';
import {
  type CreateBudgetInput,
  type UpdateBudgetInput,
  type BudgetVsActualItem,
  type BudgetListParams,
  type SpendCategory,
  type ExpenditureType,
} from './capex-opex-types';

// ─────────────────────────────────────────────────────────────────────────────
// BudgetAllocationService
// Manages CAPEX/OPEX budget allocations per OPMC per fiscal year.
// All budget vs actual computation uses O(1) HashMap join — no N² loops.
// ─────────────────────────────────────────────────────────────────────────────

export interface BudgetDTO {
  id: string;
  opmcId: string;
  fiscalYear: number;
  quarter: number | null;
  expenditureType: ExpenditureType;
  category: SpendCategory;
  allocatedAmount: number;
  description: string | null;
  status: string;
  approvedById: string | null;
  approvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const BUDGET_SELECT = {
  id: true,
  opmcId: true,
  fiscalYear: true,
  quarter: true,
  expenditureType: true,
  category: true,
  allocatedAmount: true,
  description: true,
  status: true,
  approvedById: true,
  approvedAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Record<keyof BudgetDTO, true>;

export class BudgetAllocationService {
  /**
   * Create a new budget allocation.
   * O(1) — single INSERT with unique constraint guard.
   */
  static async createBudget(input: CreateBudgetInput): Promise<FinanceBudgetAllocation> {
    return prisma.financeBudgetAllocation.create({
      data: {
        opmcId: input.opmcId,
        fiscalYear: input.fiscalYear,
        quarter: input.quarter ?? null,
        expenditureType: input.expenditureType,
        category: input.category,
        allocatedAmount: input.allocatedAmount,
        description: input.description,
        createdById: input.createdById,
        status: 'ACTIVE',
      },
    });
  }

  /**
   * Update an existing budget allocation.
   * O(1) — single UPDATE by primary key.
   */
  static async updateBudget(id: string, input: UpdateBudgetInput): Promise<FinanceBudgetAllocation> {
    const existing = await prisma.financeBudgetAllocation.findUnique({ where: { id } });
    if (!existing) throw new Error('BUDGET_NOT_FOUND');
    if (existing.status === 'FROZEN') throw new Error('BUDGET_FROZEN');

    return prisma.financeBudgetAllocation.update({
      where: { id },
      data: {
        ...(input.allocatedAmount !== undefined && { allocatedAmount: input.allocatedAmount }),
        ...(input.description !== undefined && { description: input.description }),
        ...(input.status !== undefined && { status: input.status }),
        ...(input.approvedById !== undefined && {
          approvedById: input.approvedById,
          approvedAt: new Date(),
        }),
      },
    });
  }

  /**
   * Soft-delete (freeze) a budget allocation.
   * O(1) — single UPDATE.
   */
  static async deleteBudget(id: string): Promise<void> {
    const existing = await prisma.financeBudgetAllocation.findUnique({ where: { id } });
    if (!existing) throw new Error('BUDGET_NOT_FOUND');
    await prisma.financeBudgetAllocation.update({
      where: { id },
      data: { status: 'FROZEN' },
    });
  }

  /**
   * List budgets with optional filters.
   * O(log N) — indexed lookups on opmcId, fiscalYear, expenditureType.
   */
  static async listBudgets(params: BudgetListParams): Promise<BudgetDTO[]> {
    const where = {
      ...(params.opmcId && { opmcId: params.opmcId }),
      ...(params.fiscalYear && { fiscalYear: params.fiscalYear }),
      ...(params.expenditureType && { expenditureType: params.expenditureType }),
      ...(params.status && { status: params.status }),
    };

    const results = await prisma.financeBudgetAllocation.findMany({
      where,
      select: BUDGET_SELECT,
      orderBy: [{ fiscalYear: 'desc' }, { category: 'asc' }],
    });

    return results as BudgetDTO[];
  }

  /**
   * Get a single budget by ID.
   * O(1) — primary key lookup.
   */
  static async getBudgetById(id: string): Promise<BudgetDTO | null> {
    return prisma.financeBudgetAllocation.findUnique({
      where: { id },
      select: BUDGET_SELECT,
    }) as Promise<BudgetDTO | null>;
  }

  /**
   * Core: Budget vs Actual comparison for a given OPMC + fiscal year.
   * Strategy: 
   *   1. Fetch all budgets → O(k) where k = number of budget categories
   *   2. Fetch aggregated spend from ledger → O(N/k) DB-side GROUP BY
   *   3. Join using O(1) HashMap — avoids O(k×m) nested loops
   * Total: O(N/k + k) ≈ O(N/k) for large N
   */
  static async getBudgetVsActual(
    opmcId: string,
    fiscalYear: number,
    quarter?: number
  ): Promise<BudgetVsActualItem[]> {
    // 1. Fetch budgets (small set, O(k))
    const budgets = await prisma.financeBudgetAllocation.findMany({
      where: {
        opmcId,
        fiscalYear,
        status: { not: 'FROZEN' },
        ...(quarter !== undefined ? { quarter } : { quarter: null }),
      },
      select: { id: true, category: true, expenditureType: true, allocatedAmount: true },
    });

    // 2. Fetch aggregated actuals from ledger — O(N/k) DB GROUP BY
    const actuals = await prisma.capexOpexLedgerEntry.groupBy({
      by: ['category', 'expenditureType'],
      where: {
        opmcId,
        fiscalYear,
        ...(quarter !== undefined && { quarter }),
      },
      _sum: { amount: true },
    });

    // 3. Build O(1) lookup map from actuals — key: "CATEGORY::TYPE"
    const actualMap = new Map<string, number>();
    for (const row of actuals) {
      const key = `${row.category}::${row.expenditureType}`;
      actualMap.set(key, row._sum.amount ?? 0);
    }

    // 4. Join budgets with actuals — O(k) single pass
    const ALERT_THRESHOLD = 90; // percent

    return budgets.map((budget) => {
      const key = `${budget.category}::${budget.expenditureType}`;
      const actual = actualMap.get(key) ?? 0;
      const variance = budget.allocatedAmount - actual;
      const utilizationPct =
        budget.allocatedAmount > 0 ? Math.round((actual / budget.allocatedAmount) * 100) : 0;

      return {
        category: budget.category as SpendCategory,
        expenditureType: budget.expenditureType as ExpenditureType,
        allocated: budget.allocatedAmount,
        actual,
        variance,
        utilizationPct,
        isAlert: utilizationPct >= ALERT_THRESHOLD,
      };
    });
  }

  /**
   * Cross-OPMC summary for HO Finance dashboard.
   * O(M×k) where M = number of OPMCs, k = categories.
   */
  static async getCrossOpmcSummary(
    fiscalYear: number
  ): Promise<{ opmcId: string; capexBudget: number; opexBudget: number; capexActual: number; opexActual: number }[]> {
    const [budgets, actuals] = await Promise.all([
      prisma.financeBudgetAllocation.groupBy({
        by: ['opmcId', 'expenditureType'],
        where: { fiscalYear, status: { not: 'FROZEN' } },
        _sum: { allocatedAmount: true },
      }),
      prisma.capexOpexLedgerEntry.groupBy({
        by: ['opmcId', 'expenditureType'],
        where: { fiscalYear },
        _sum: { amount: true },
      }),
    ]);

    // O(1) map build then O(M) join — no nested loops
    const summaryMap = new Map<string, { opmcId: string; capexBudget: number; opexBudget: number; capexActual: number; opexActual: number }>();

    for (const b of budgets as { opmcId: string; expenditureType: string; _sum: { allocatedAmount: number | null } }[]) {
      if (!summaryMap.has(b.opmcId)) {
        summaryMap.set(b.opmcId, { opmcId: b.opmcId, capexBudget: 0, opexBudget: 0, capexActual: 0, opexActual: 0 });
      }
      const entry = summaryMap.get(b.opmcId)!;
      if (b.expenditureType === 'CAPEX') entry.capexBudget = b._sum.allocatedAmount ?? 0;
      else entry.opexBudget = b._sum.allocatedAmount ?? 0;
    }

    for (const a of actuals as { opmcId: string; expenditureType: string; _sum: { amount: number | null } }[]) {
      if (!summaryMap.has(a.opmcId)) {
        summaryMap.set(a.opmcId, { opmcId: a.opmcId, capexBudget: 0, opexBudget: 0, capexActual: 0, opexActual: 0 });
      }
      const entry = summaryMap.get(a.opmcId)!;
      if (a.expenditureType === 'CAPEX') entry.capexActual = a._sum.amount ?? 0;
      else entry.opexActual = a._sum.amount ?? 0;
    }

    return Array.from(summaryMap.values());
  }
}

const _: typeof BudgetAllocationService = BudgetAllocationService;
export default _;
