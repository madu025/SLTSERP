import { prisma } from '@/lib/prisma';
import type { CapexOpexLedgerEntry, FinanceBudgetAllocation } from '@prisma/client';
import {
  type CreateLedgerEntryInput,
  type LedgerListParams,
  type SpendCategory,
  type ExpenditureType,
  getFiscalYear,
  getQuarter,
} from './capex-opex-types';

// ─────────────────────────────────────────────────────────────────────────────
// CapexOpexLedgerService
// Responsible for writing and reading the unified CAPEX/OPEX ledger.
// Big-O: All reads are index-backed O(log N) or DB-aggregated O(N/k).
//        All writes are O(1) single-row inserts.
// ─────────────────────────────────────────────────────────────────────────────

export interface LedgerEntryDTO {
  id: string;
  opmcId: string;
  expenditureType: ExpenditureType;
  category: SpendCategory;
  sourceType: string;
  sourceId: string;
  amount: number;
  transactionDate: Date;
  fiscalYear: number;
  quarter: number;
  description: string;
  referenceNumber: string | null;
  projectId: string | null;
  createdAt: Date;
}

export interface AggregatedSpend {
  category: SpendCategory;
  expenditureType: ExpenditureType;
  total: number;
}

export interface LedgerPage {
  items: LedgerEntryDTO[];
  total: number;
  page: number;
  limit: number;
}

// Selective DTO fields — prevents egress bloat
const LEDGER_SELECT = {
  id: true,
  opmcId: true,
  expenditureType: true,
  category: true,
  sourceType: true,
  sourceId: true,
  amount: true,
  transactionDate: true,
  fiscalYear: true,
  quarter: true,
  description: true,
  referenceNumber: true,
  projectId: true,
  createdAt: true,
} satisfies Record<keyof LedgerEntryDTO, true>;

export class CapexOpexLedgerService {
  /**
   * Record a single CAPEX/OPEX ledger entry.
   * O(1) — single DB insert.
   */
  static async recordEntry(input: CreateLedgerEntryInput): Promise<CapexOpexLedgerEntry> {
    const date = input.transactionDate ?? new Date();
    const fiscalYear = getFiscalYear(date);
    const quarter = getQuarter(date);

    return prisma.capexOpexLedgerEntry.create({
      data: {
        opmcId: input.opmcId,
        expenditureType: input.expenditureType,
        category: input.category,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        amount: input.amount,
        transactionDate: date,
        fiscalYear,
        quarter,
        description: input.description,
        referenceNumber: input.referenceNumber,
        vendorId: input.vendorId,
        projectId: input.projectId,
        budgetId: input.budgetId,
        createdById: input.createdById,
      },
    });
  }

  /**
   * Get paginated ledger entries for an OPMC.
   * O(log N) via composite indexes.
   */
  static async getEntries(params: LedgerListParams): Promise<LedgerPage> {
    const page = Math.max(1, params.page ?? 1);
    const limit = Math.min(100, params.limit ?? 20);
    const skip = (page - 1) * limit;

    const where = {
      ...(params.opmcId && { opmcId: params.opmcId }),
      ...(params.fiscalYear && { fiscalYear: params.fiscalYear }),
      ...(params.quarter && { quarter: params.quarter }),
      ...(params.expenditureType && { expenditureType: params.expenditureType }),
      ...(params.category && { category: params.category }),
      ...(params.sourceType && { sourceType: params.sourceType }),
    };

    const [items, total] = await prisma.$transaction([
      prisma.capexOpexLedgerEntry.findMany({
        where,
        select: LEDGER_SELECT,
        orderBy: { transactionDate: 'desc' },
        skip,
        take: limit,
      }),
      prisma.capexOpexLedgerEntry.count({ where }),
    ]);

    return {
      items: items as LedgerEntryDTO[],
      total,
      page,
      limit,
    };
  }

  /**
   * Aggregate spend totals grouped by category and expenditureType.
   * O(N/k) — DB-side GROUP BY aggregation, no in-memory loops.
   */
  static async getAggregatedSpend(
    opmcId: string,
    fiscalYear: number,
    quarter?: number
  ): Promise<AggregatedSpend[]> {
    const where = {
      opmcId,
      fiscalYear,
      ...(quarter && { quarter }),
    };

    const grouped = await prisma.capexOpexLedgerEntry.groupBy({
      by: ['category', 'expenditureType'],
      where,
      _sum: { amount: true },
      orderBy: { _sum: { amount: 'desc' } },
    });

    return grouped.map((g: { category: string; expenditureType: string; _sum: { amount: number | null } }) => ({
      category: g.category as SpendCategory,
      expenditureType: g.expenditureType as ExpenditureType,
      total: g._sum.amount ?? 0,
    }));
  }

  /**
   * Get monthly spend totals for trend charts.
   * Returns 12 months of data grouped by month for the given fiscal year.
   * O(N/12) — DB-level aggregation bucketed by month.
   */
  static async getMonthlyTotals(
    opmcId: string,
    fiscalYear: number
  ): Promise<{ month: number; quarter: number; capex: number; opex: number }[]> {
    // Use raw query for month-level grouping (Prisma groupBy doesn't support EXTRACT)
    const rows = await prisma.$queryRaw<
      { month: number; quarter: number; expenditure_type: string; total: number }[]
    >`
      SELECT
        EXTRACT(MONTH FROM "transactionDate")::int AS month,
        "quarter",
        "expenditureType" AS expenditure_type,
        COALESCE(SUM("amount"), 0)::float AS total
      FROM "CapexOpexLedgerEntry"
      WHERE "opmcId" = ${opmcId}
        AND "fiscalYear" = ${fiscalYear}
      GROUP BY month, "quarter", "expenditureType"
      ORDER BY month ASC
    `;

    // Build a HashMap O(N) once, then query O(1) per month — no N² iteration
    const monthMap = new Map<number, { month: number; quarter: number; capex: number; opex: number }>();
    for (let m = 1; m <= 12; m++) {
      monthMap.set(m, { month: m, quarter: Math.ceil(m / 3), capex: 0, opex: 0 });
    }
    for (const row of rows) {
      const entry = monthMap.get(row.month);
      if (entry) {
        if (row.expenditure_type === 'CAPEX') entry.capex = Number(row.total);
        else entry.opex = Number(row.total);
      }
    }

    return Array.from(monthMap.values());
  }

  /**
   * Bulk-sync existing data into the ledger (admin-only, one-time operation).
   * Uses prisma.$transaction batch to avoid N individual round-trips.
   * O(N) over all source records.
   */
  static async bulkSyncFromProjectExpenses(
    opmcId: string,
    projectIds: string[],
    createdById: string
  ): Promise<{ synced: number; skipped: number }> {
    if (projectIds.length === 0) return { synced: 0, skipped: 0 };

    // Fetch all expenses for these projects not yet in ledger
    const expenses = await prisma.projectExpense.findMany({
      where: { projectId: { in: projectIds } },
      select: { id: true, projectId: true, type: true, description: true, amount: true, date: true, invoiceRef: true },
    });

    // Get already-synced sourceIds to avoid duplicates — O(M) set lookup
    const existingSourceIds = new Set(
      (
        await prisma.capexOpexLedgerEntry.findMany({
          where: { sourceType: 'PROJECT_EXPENSE', opmcId },
          select: { sourceId: true },
        })
      ).map((e) => e.sourceId)
    );

    const toCreate: Parameters<typeof prisma.capexOpexLedgerEntry.create>[0]['data'][] = [];

    for (const expense of expenses) {
      if (existingSourceIds.has(expense.id)) continue;

      const date = expense.date ?? new Date();
      const expType = expense.type?.toUpperCase() ?? '';
      const isCapex = ['MATERIAL', 'EQUIPMENT', 'CIVIL', 'ASSET'].includes(expType);
      const expenditureType: ExpenditureType = isCapex ? 'CAPEX' : 'OPEX';
      const categoryMap: Record<string, SpendCategory> = {
        MATERIAL: 'NETWORK_INFRA',
        CIVIL: 'NETWORK_INFRA',
        EQUIPMENT: 'EQUIPMENT',
        TRANSPORT: 'VEHICLE',
        LABOUR: 'CONTRACTOR_PAYMENT',
        MAINTENANCE: 'MAINTENANCE',
      };
      const category: SpendCategory = categoryMap[expType] ?? 'OTHER';

      toCreate.push({
        opmcId,
        expenditureType,
        category,
        sourceType: 'PROJECT_EXPENSE',
        sourceId: expense.id,
        amount: expense.amount,
        transactionDate: date,
        fiscalYear: getFiscalYear(date),
        quarter: getQuarter(date),
        description: expense.description,
        referenceNumber: expense.invoiceRef,
        projectId: expense.projectId,
        createdById,
      });
    }

    if (toCreate.length === 0) return { synced: 0, skipped: expenses.length };

    // Batch insert using $transaction for atomicity — avoids N separate round-trips
    await prisma.$transaction(
      toCreate.map((data) => prisma.capexOpexLedgerEntry.create({ data }))
    );

    return { synced: toCreate.length, skipped: expenses.length - toCreate.length };
  }

  /**
   * Check if a specific source record is already in the ledger.
   * O(1) — index lookup.
   */
  static async isAlreadySynced(sourceType: string, sourceId: string): Promise<boolean> {
    const count = await prisma.capexOpexLedgerEntry.count({
      where: { sourceType, sourceId },
    });
    return count > 0;
  }

  /**
   * Delete a ledger entry (manual entries only).
   * O(1).
   */
  static async deleteEntry(id: string): Promise<void> {
    const entry = await prisma.capexOpexLedgerEntry.findUnique({
      where: { id },
      select: { sourceType: true },
    });
    if (!entry) throw new Error('ENTRY_NOT_FOUND');
    if (entry.sourceType !== 'MANUAL') throw new Error('CANNOT_DELETE_SYNCED_ENTRY');
    await prisma.capexOpexLedgerEntry.delete({ where: { id } });
  }
}

// Prevent type widening issues
const _: typeof CapexOpexLedgerService = CapexOpexLedgerService;
export default _;
