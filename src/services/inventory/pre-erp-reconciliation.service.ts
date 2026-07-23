import { prisma } from '@/lib/prisma';
import type { PreErpMaterialBalance, MaterialVarianceAdjustment } from '@prisma/client';

// ─────────────────────────────────────────────────────────────────────────────
// Pre-ERP Reconciliation Service
// Manages data entry, physical variance adjustments, and ERP stock initialization.
// Big-O:
//   - listBalances: O(log N) composite index lookups
//   - createAdjustment: O(1) single transaction
//   - approveAdjustment: O(1) single transaction + InventoryStock upsert
// ─────────────────────────────────────────────────────────────────────────────

export interface BalanceFilterParams {
  opmcId?: string | null;
  year?: number;
  month?: string;
  itemId?: string;
  status?: string;
  page?: number;
  limit?: number;
}

export interface ReconcileAdjustmentInput {
  balanceId: string;
  physicalAuditedQty: number;
  varianceReason: 'UNRECORDED_RECEIPT' | 'BUFFER_STOCK' | 'FIELD_SCRAP' | 'OTHER';
  createdById: string;
}

export interface ManualBalanceInput {
  opmcId: string;
  itemId: string;
  year: number;
  month: string;
  carryForwardQuantity: number;
  receivedQuantity: number;
  usageQuantity: number;
  wastageQuantity?: number;
  faultyQuantity?: number;
  unitCostLkr?: number;
  createdById?: string;
}

const ITEM_WASTAGE_PCT_MAP: Record<string, number> = {
  'FAC_CONN': 0.02,
  'FIBER_DROP_F1G1': 0.05,
  'DW_RETAINER': 0.01,
  'CAT5E': 0.01,
  'TWIN_WIRE': 0.05,
};

function round2(val: number): number {
  return Math.round((val + Number.EPSILON) * 100) / 100;
}

export class PreErpReconciliationService {
  /**
   * List Pre-ERP Material Balances with pagination and filters.
   * O(log N) composite index.
   */
  static async listBalances(params: BalanceFilterParams) {
    const page = Math.max(1, params.page ?? 1);
    const limit = Math.min(500, params.limit ?? 50);
    const skip = (page - 1) * limit;

    const where = {
      ...(params.opmcId && { opmcId: params.opmcId }),
      ...(params.year && { year: params.year }),
      ...(params.month && { month: params.month.toUpperCase() }),
      ...(params.itemId && { itemId: params.itemId }),
      ...(params.status && { status: params.status }),
    };

    const [items, total] = await prisma.$transaction([
      prisma.preErpMaterialBalance.findMany({
        where,
        include: {
          item: { select: { id: true, code: true, name: true, unit: true } },
          opmc: { select: { id: true, name: true, rtom: true } },
          adjustments: { orderBy: { createdAt: 'desc' }, take: 1 },
        },
        orderBy: [{ year: 'desc' }, { month: 'desc' }, { itemCode: 'asc' }],
        skip,
        take: limit,
      }),
      prisma.preErpMaterialBalance.count({ where }),
    ]);

    return { items, total, page, limit };
  }

  /**
   * Create or update a manual Pre-ERP material balance entry.
   * O(1)
   */
  static async upsertManualBalance(input: ManualBalanceInput): Promise<PreErpMaterialBalance> {
    const item = await prisma.inventoryItem.findUnique({ where: { id: input.itemId } });
    if (!item) throw new Error('ITEM_NOT_FOUND');

    const carryForward = round2(input.carryForwardQuantity);
    const received = round2(input.receivedQuantity);
    const usage = round2(input.usageQuantity);

    // Auto calculate wastage if not explicitly given
    const wastagePct = ITEM_WASTAGE_PCT_MAP[item.code] ?? 0;
    const wastage = input.wastageQuantity !== undefined ? round2(input.wastageQuantity) : round2(usage * wastagePct);

    const totalInHand = round2(carryForward + received);
    const totalUsage = round2(usage + wastage);
    const closingBalance = round2(totalInHand - totalUsage);

    return prisma.preErpMaterialBalance.upsert({
      where: {
        itemId_year_month: {
          itemId: input.itemId,
          year: input.year,
          month: input.month.toUpperCase(),
        },
      },
      update: {
        carryForwardQuantity: carryForward,
        receivedQuantity: received,
        totalInHandQuantity: totalInHand,
        usageQuantity: usage,
        wastageQuantity: wastage,
        faultyQuantity: round2(input.faultyQuantity ?? 0),
        totalUsageQuantity: totalUsage,
        closingBalanceQuantity: closingBalance,
        ...(input.unitCostLkr !== undefined && { unitCostLkr: round2(input.unitCostLkr) }),
      },
      create: {
        opmcId: input.opmcId,
        itemId: input.itemId,
        itemCode: item.code,
        itemName: item.name,
        year: input.year,
        month: input.month.toUpperCase(),
        carryForwardQuantity: carryForward,
        receivedQuantity: received,
        totalInHandQuantity: totalInHand,
        usageQuantity: usage,
        wastageQuantity: wastage,
        faultyQuantity: round2(input.faultyQuantity ?? 0),
        totalUsageQuantity: totalUsage,
        closingBalanceQuantity: closingBalance,
        unitCostLkr: round2(input.unitCostLkr ?? 0),
        createdById: input.createdById ?? 'SYSTEM',
      },
    });
  }

  /**
   * Bulk upsert monthly balances for multiple items in a month.
   */
  static async bulkUpsertMonthBalances(inputs: ManualBalanceInput[]): Promise<{ count: number }> {
    let count = 0;
    for (const input of inputs) {
      await this.upsertManualBalance(input);
      count++;
    }
    return { count };
  }

  /**
   * Submit a physical audit variance adjustment for a balance record.
   * O(1)
   */
  static async submitVarianceAdjustment(
    input: ReconcileAdjustmentInput
  ): Promise<MaterialVarianceAdjustment> {
    const balance = await prisma.preErpMaterialBalance.findUnique({
      where: { id: input.balanceId },
    });
    if (!balance) throw new Error('BALANCE_RECORD_NOT_FOUND');

    const varianceQty = input.physicalAuditedQty - balance.closingBalanceQuantity;
    const financialImpact = varianceQty * balance.unitCostLkr;

    const adjustment = await prisma.materialVarianceAdjustment.create({
      data: {
        balanceId: balance.id,
        opmcId: balance.opmcId,
        itemId: balance.itemId,
        systemCalculatedQty: balance.closingBalanceQuantity,
        physicalAuditedQty: input.physicalAuditedQty,
        varianceQuantity: varianceQty,
        varianceReason: input.varianceReason,
        financialImpactLkr: financialImpact,
        status: 'PENDING',
        createdById: input.createdById,
      },
    });

    // Update balance status to ADJUSTED
    await prisma.preErpMaterialBalance.update({
      where: { id: balance.id },
      data: { status: 'ADJUSTED' },
    });

    return adjustment;
  }

  /**
   * Approve a physical variance adjustment and initialize ground-truth InventoryStock in ERP.
   * O(1)
   */
  static async approveAdjustment(
    adjustmentId: string,
    approvedById: string
  ): Promise<{ adjustment: MaterialVarianceAdjustment; inventoryStockId: string }> {
    const adjustment = await prisma.materialVarianceAdjustment.findUnique({
      where: { id: adjustmentId },
      include: { balance: true, opmc: true },
    });

    if (!adjustment) throw new Error('ADJUSTMENT_NOT_FOUND');
    if (adjustment.status !== 'PENDING') throw new Error('ADJUSTMENT_ALREADY_PROCESSED');

    // Find or locate OPMC store (fallback to main store if opmc not specified)
    const storeId = adjustment.opmc?.storeId || (await prisma.inventoryStore.findFirst())?.id;
    if (!storeId) {
      throw new Error('No active main store found. Please create an InventoryStore first.');
    }

    // Perform atomic transaction: Approve adjustment + Upsert InventoryStock opening balance
    const [updatedAdjustment, stock] = await prisma.$transaction([
      prisma.materialVarianceAdjustment.update({
        where: { id: adjustmentId },
        data: {
          status: 'APPROVED',
          approvedById,
          approvedAt: new Date(),
        },
      }),
      prisma.inventoryStock.upsert({
        where: {
          id: `${storeId}_${adjustment.itemId}`, // fallback lookup or standard query
        },
        update: {
          quantity: adjustment.physicalAuditedQty,
        },
        create: {
          storeId,
          itemId: adjustment.itemId,
          quantity: adjustment.physicalAuditedQty,
        },
      }),
      prisma.preErpMaterialBalance.update({
        where: { id: adjustment.balanceId },
        data: {
          status: 'RECONCILED',
          closingBalanceQuantity: adjustment.physicalAuditedQty,
        },
      }),
    ]);

    return {
      adjustment: updatedAdjustment,
      inventoryStockId: stock.id,
    };
  }

  /**
   * Reject a physical variance adjustment.
   * O(1)
   */
  static async rejectAdjustment(
    adjustmentId: string,
    approvedById: string,
    rejectionReason: string
  ): Promise<MaterialVarianceAdjustment> {
    const adjustment = await prisma.materialVarianceAdjustment.findUnique({
      where: { id: adjustmentId },
    });

    if (!adjustment) throw new Error('ADJUSTMENT_NOT_FOUND');
    if (adjustment.status !== 'PENDING') throw new Error('ADJUSTMENT_ALREADY_PROCESSED');

    return prisma.materialVarianceAdjustment.update({
      where: { id: adjustmentId },
      data: {
        status: 'REJECTED',
        approvedById,
        approvedAt: new Date(),
        rejectionReason,
      },
    });
  }
}
