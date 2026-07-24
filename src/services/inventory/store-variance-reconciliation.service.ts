import { prisma } from '@/lib/prisma';
import { AppError } from '@/lib/error';

export interface StoreItemVarianceSummary {
  itemId: string;
  itemCode: string;
  itemName: string;
  unit: string;
  totalGRNReceived: number;
  totalDispatchedToContractor: number;
  totalSODUsage: number;
  totalReturns: number;
  totalWastage: number;
  calculatedInHandBalance: number;
  physicalAuditedStock: number;
  varianceQty: number;
  unitCostLkr: number;
  varianceFinancialImpactLkr: number;
  discrepancyStatus: 'SURPLUS' | 'DEFICIT' | 'BALANCED';
  fraudRiskLevel: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface StoreVarianceAuditReport {
  storeId: string;
  storeName: string;
  auditedAt: Date;
  totalItemsAudited: number;
  totalDeficitCount: number;
  totalSurplusCount: number;
  netFinancialVarianceLkr: number;
  criticalFraudRiskItemsCount: number;
  itemVariances: StoreItemVarianceSummary[];
}

export class StoreVarianceReconciliationService {
  /**
   * Run 3-Way Variance Audit for a specific Store or Contractor Store.
   * Big-O: DB aggregate query O(N/k)
   */
  static async auditStoreVariance(storeId: string): Promise<StoreVarianceAuditReport> {
    if (!storeId) throw AppError.badRequest('STORE_ID_REQUIRED');

    const store = await prisma.inventoryStore.findUnique({
      where: { id: storeId },
      select: { id: true, name: true }
    });

    if (!store) throw AppError.badRequest(`STORE_NOT_FOUND: ${storeId}`);

    // Fetch physical current stock balances for the store
    const stockRecords = await prisma.inventoryStock.findMany({
      where: { storeId },
      include: {
        item: {
          select: {
            id: true,
            code: true,
            name: true,
            unit: true,
            costPrice: true
          }
        }
      }
    });

    const itemIds = stockRecords.map((s) => s.itemId);

    // 1. Fetch total GRN Received per item for this store
    const grnItemsGroup = await prisma.gRNItem.groupBy({
      by: ['itemId'],
      where: {
        grn: { storeId }
      },
      _sum: { quantity: true }
    });
    const grnMap = new Map<string, number>(
      grnItemsGroup.map((g) => [g.itemId, Number(g._sum.quantity || 0)])
    );

    // 2. Fetch total Contractor Dispatches (Stock Issues)
    const issuesGroup = await prisma.contractorMaterialIssueItem.groupBy({
      by: ['itemId'],
      where: {
        issue: { storeId, status: 'ACCEPTED' }
      },
      _sum: { quantity: true }
    });
    const issueMap = new Map<string, number>(
      issuesGroup.map((i) => [i.itemId, Number(i._sum.quantity || 0)])
    );

    // 3. Fetch total SOD Material Usage linked to this store
    const sodUsageGroup = await prisma.sODMaterialUsage.groupBy({
      by: ['itemId'],
      where: {
        itemId: { in: itemIds }
      },
      _sum: { quantity: true }
    });
    const sodUsageMap = new Map<string, number>(
      sodUsageGroup.map((s) => [s.itemId, Number(s._sum.quantity || 0)])
    );

    // 4. Fetch total Approved Returns
    const returnsGroup = await prisma.contractorMaterialReturnItem.groupBy({
      by: ['itemId'],
      where: {
        return: { storeId, status: 'ACCEPTED' }
      },
      _sum: { quantity: true }
    });
    const returnsMap = new Map<string, number>(
      returnsGroup.map((r) => [r.itemId, Number(r._sum.quantity || 0)])
    );

    // 5. Fetch total Approved Wastage
    const wastageGroup = await prisma.contractorWastageItem.groupBy({
      by: ['itemId'],
      where: {
        wastage: { storeId, status: 'APPROVED' }
      },
      _sum: { quantity: true }
    });
    const wastageMap = new Map<string, number>(
      wastageGroup.map((w) => [w.itemId, Number(w._sum.quantity || 0)])
    );

    let totalDeficitCount = 0;
    let totalSurplusCount = 0;
    let netFinancialVarianceLkr = 0;
    let criticalFraudRiskItemsCount = 0;

    const itemVariances: StoreItemVarianceSummary[] = stockRecords.map((stock) => {
      const itemId = stock.itemId;
      const grnQty = grnMap.get(itemId) || 0;
      const issueQty = issueMap.get(itemId) || 0;
      const usageQty = sodUsageMap.get(itemId) || 0;
      const returnQty = returnsMap.get(itemId) || 0;
      const wastageQty = wastageMap.get(itemId) || 0;

      // Calculated Balance = Received - Issued/Used + Returns - Wastage
      const calculatedBalance = Math.max(0, grnQty - (issueQty > 0 ? issueQty : usageQty) + returnQty - wastageQty);
      const physicalStock = Number(stock.quantity || 0);
      const varianceQty = physicalStock - calculatedBalance;
      const unitCost = Number(stock.item.costPrice || 0);
      const financialImpact = Math.round(varianceQty * unitCost * 100) / 100;

      netFinancialVarianceLkr += financialImpact;

      let discrepancyStatus: 'SURPLUS' | 'DEFICIT' | 'BALANCED' = 'BALANCED';
      if (varianceQty < -0.0001) {
        discrepancyStatus = 'DEFICIT';
        totalDeficitCount++;
      } else if (varianceQty > 0.0001) {
        discrepancyStatus = 'SURPLUS';
        totalSurplusCount++;
      }

      let fraudRiskLevel: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' = 'LOW';
      if (discrepancyStatus === 'DEFICIT') {
        const absVal = Math.abs(financialImpact);
        if (absVal > 100000) {
          fraudRiskLevel = 'CRITICAL';
          criticalFraudRiskItemsCount++;
        } else if (absVal > 25000) {
          fraudRiskLevel = 'HIGH';
        } else if (absVal > 5000) {
          fraudRiskLevel = 'MEDIUM';
        }
      }

      return {
        itemId,
        itemCode: stock.item.code,
        itemName: stock.item.name,
        unit: stock.item.unit,
        totalGRNReceived: grnQty,
        totalDispatchedToContractor: issueQty,
        totalSODUsage: usageQty,
        totalReturns: returnQty,
        totalWastage: wastageQty,
        calculatedInHandBalance: calculatedBalance,
        physicalAuditedStock: physicalStock,
        varianceQty,
        unitCostLkr: unitCost,
        varianceFinancialImpactLkr: financialImpact,
        discrepancyStatus,
        fraudRiskLevel
      };
    });

    return {
      storeId: store.id,
      storeName: store.name,
      auditedAt: new Date(),
      totalItemsAudited: stockRecords.length,
      totalDeficitCount,
      totalSurplusCount,
      netFinancialVarianceLkr: Math.round(netFinancialVarianceLkr * 100) / 100,
      criticalFraudRiskItemsCount,
      itemVariances
    };
  }
}
