import { prisma } from '@/lib/prisma';
import { AppError } from '@/lib/error';

export interface ConsumableItemAuditSummary {
  itemId: string;
  itemCode: string;
  itemName: string;
  category: 'DROP_WIRE' | 'FAST_CONNECTOR' | 'SPLITTER' | 'TENSION_CLAMP' | 'ROSETTE_SLEEVE' | 'GENERAL_CONSUMABLE';
  unit: string;
  totalIssuedToContractors: number;
  totalLoggedSODUsage: number;
  expectedUsageFromSODMetrics: number; // e.g. sum(dropWireDistance) or 2x SODs for FAC
  totalApprovedReturns: number;
  totalApprovedWastage: number;
  currentInHandStock: number;
  unaccountedLeakageQty: number;
  unitCostLkr: number;
  leakageFinancialImpactLkr: number;
  auditAlertStatus: 'NORMAL' | 'OVER_USAGE' | 'MISSING_LOGS' | 'CRITICAL_LEAKAGE';
  anomalousSODCount: number;
}

export interface ConsumableStoreAuditReport {
  storeId?: string;
  contractorId?: string;
  contractorName?: string;
  month?: string;
  auditedAt: Date;
  totalConsumablesAudited: number;
  totalUnaccountedLeakageCostLkr: number;
  highRiskConsumableCount: number;
  items: ConsumableItemAuditSummary[];
}

export class ConsumableAuditService {
  /**
   * Classify item into consumable category based on code or name
   */
  static classifyConsumable(code: string, name: string): ConsumableItemAuditSummary['category'] {
    const c = (code || '').toUpperCase();
    const n = (name || '').toUpperCase();

    if (c.includes('F-1') || c.includes('G-1') || c.includes('F1') || c.includes('G1') || c.includes('DW') || n.includes('DROP WIRE') || n.includes('DROPWIRE')) {
      return 'DROP_WIRE';
    }
    if (c.includes('FAC') || n.includes('FAST CONNECTOR') || n.includes('FAC CONNECTOR')) {
      return 'FAST_CONNECTOR';
    }
    if (c.includes('SPLIT') || n.includes('SPLITTER') || n.includes('OPTICAL SPLITTER')) {
      return 'SPLITTER';
    }
    if (c.includes('CLAMP') || n.includes('CLAMP') || n.includes('TENSION') || n.includes('BRACKET')) {
      return 'TENSION_CLAMP';
    }
    if (c.includes('ROSETTE') || c.includes('SLEEVE') || n.includes('ROSETTE') || n.includes('PROTECTION SLEEVE')) {
      return 'ROSETTE_SLEEVE';
    }

    return 'GENERAL_CONSUMABLE';
  }

  /**
   * Audit Non-Serialized Consumable Materials for a Store or Contractor
   */
  static async auditConsumables(params: {
    storeId?: string;
    contractorId?: string;
    month?: string;
  }): Promise<ConsumableStoreAuditReport> {
    const { storeId, contractorId, month } = params;

    // 1. Fetch non-serialized items (hasSerial = false)
    const items = await prisma.inventoryItem.findMany({
      where: {
        hasSerial: false
      },
      select: {
        id: true,
        code: true,
        name: true,
        unit: true,
        costPrice: true
      }
    });

    const itemIds = items.map((i) => i.id);

    // 2. Fetch Issued Quantities to Contractor/Store
    const issueWhere: any = { issue: { status: 'ACCEPTED' }, itemId: { in: itemIds } };
    if (storeId) issueWhere.issue.storeId = storeId;
    if (contractorId) issueWhere.issue.contractorId = contractorId;
    if (month) issueWhere.issue.month = month;

    const issuesGroup = await prisma.contractorMaterialIssueItem.groupBy({
      by: ['itemId'],
      where: issueWhere,
      _sum: { quantity: true }
    });
    const issueMap = new Map<string, number>(
      issuesGroup.map((i) => [i.itemId, Number(i._sum.quantity || 0)])
    );

    // 3. Fetch SOD Material Usage
    const sodWhere: any = { itemId: { in: itemIds } };
    if (contractorId) {
      sodWhere.serviceOrder = { contractorId };
    }
    const sodUsageGroup = await prisma.sODMaterialUsage.groupBy({
      by: ['itemId'],
      where: sodWhere,
      _sum: { quantity: true }
    });
    const sodUsageMap = new Map<string, number>(
      sodUsageGroup.map((s) => [s.itemId, Number(s._sum.quantity || 0)])
    );

    // 4. Fetch Approved Returns
    const returnWhere: any = { return: { status: 'ACCEPTED' }, itemId: { in: itemIds } };
    if (storeId) returnWhere.return.storeId = storeId;
    if (contractorId) returnWhere.return.contractorId = contractorId;
    if (month) returnWhere.return.month = month;

    const returnsGroup = await prisma.contractorMaterialReturnItem.groupBy({
      by: ['itemId'],
      where: returnWhere,
      _sum: { quantity: true }
    });
    const returnMap = new Map<string, number>(
      returnsGroup.map((r) => [r.itemId, Number(r._sum.quantity || 0)])
    );

    // 5. Fetch Approved Wastage
    const wastageWhere: any = { wastage: { status: 'APPROVED' }, itemId: { in: itemIds } };
    if (storeId) wastageWhere.wastage.storeId = storeId;
    if (contractorId) wastageWhere.wastage.contractorId = contractorId;
    if (month) wastageWhere.wastage.month = month;

    const wastageGroup = await prisma.contractorWastageItem.groupBy({
      by: ['itemId'],
      where: wastageWhere,
      _sum: { quantity: true }
    });
    const wastageMap = new Map<string, number>(
      wastageGroup.map((w) => [w.itemId, Number(w._sum.quantity || 0)])
    );

    // 6. Fetch Current Stock Balances
    const stockWhere: any = { itemId: { in: itemIds } };
    if (storeId) stockWhere.storeId = storeId;
    const stockGroup = await prisma.inventoryStock.groupBy({
      by: ['itemId'],
      where: stockWhere,
      _sum: { quantity: true }
    });
    const stockMap = new Map<string, number>(
      stockGroup.map((s) => [s.itemId, Number(s._sum.quantity || 0)])
    );

    // 7. Calculate total completed SODs and total recorded drop wire distance
    const sodFilter: any = { sltsStatus: 'COMPLETED' };
    if (contractorId) sodFilter.contractorId = contractorId;

    const completedSodsCount = await prisma.serviceOrder.count({ where: sodFilter });
    const dropWireAggregate = await prisma.serviceOrder.aggregate({
      where: sodFilter,
      _sum: { dropWireDistance: true }
    });
    const totalDropWireDistanceMeters = Number(dropWireAggregate._sum.dropWireDistance || 0);

    let totalUnaccountedLeakageCostLkr = 0;
    let highRiskConsumableCount = 0;

    const auditItems: ConsumableItemAuditSummary[] = items.map((item) => {
      const category = this.classifyConsumable(item.code, item.name);
      const totalIssued = issueMap.get(item.id) || 0;
      const totalSODUsage = sodUsageMap.get(item.id) || 0;
      const totalReturns = returnMap.get(item.id) || 0;
      const totalWastage = wastageMap.get(item.id) || 0;
      const currentStock = stockMap.get(item.id) || 0;

      // Calculate Expected Usage based on category metrics
      let expectedUsage = totalSODUsage;
      if (category === 'DROP_WIRE') {
        expectedUsage = totalDropWireDistanceMeters;
      } else if (category === 'FAST_CONNECTOR') {
        expectedUsage = completedSodsCount * 2; // 2 FACs per standard FTTH installation
      }

      // Allowed wastage: 5% for Drop Wire, 2% for FAC, 1% for others
      const wastagePct = category === 'DROP_WIRE' ? 0.05 : category === 'FAST_CONNECTOR' ? 0.02 : 0.01;
      const allowedWastage = Math.round(totalSODUsage * wastagePct * 100) / 100;

      // Leakage Formula = Issued - (Usage + Returns + ApprovedWastage) - CurrentStock
      const expectedInHand = Math.max(0, totalIssued - (totalSODUsage + totalReturns + Math.max(totalWastage, allowedWastage)));
      const unaccountedLeakage = Math.max(0, expectedInHand - currentStock);

      const unitCost = Number(item.costPrice || 0);
      const leakageCost = Math.round(unaccountedLeakage * unitCost * 100) / 100;
      totalUnaccountedLeakageCostLkr += leakageCost;

      let auditAlertStatus: ConsumableItemAuditSummary['auditAlertStatus'] = 'NORMAL';
      let anomalousSODCount = 0;

      if (category === 'DROP_WIRE' && totalSODUsage > 0 && Math.abs(totalSODUsage - totalDropWireDistanceMeters) > (totalDropWireDistanceMeters * 0.15)) {
        auditAlertStatus = 'OVER_USAGE';
        anomalousSODCount = 1;
      } else if (category === 'FAST_CONNECTOR' && totalSODUsage > (completedSodsCount * 2.2)) {
        auditAlertStatus = 'OVER_USAGE';
        anomalousSODCount = Math.ceil(totalSODUsage - (completedSodsCount * 2));
      }

      if (leakageCost > 50000) {
        auditAlertStatus = 'CRITICAL_LEAKAGE';
        highRiskConsumableCount++;
      }

      return {
        itemId: item.id,
        itemCode: item.code,
        itemName: item.name,
        category,
        unit: item.unit,
        totalIssuedToContractors: totalIssued,
        totalLoggedSODUsage: totalSODUsage,
        expectedUsageFromSODMetrics: expectedUsage,
        totalApprovedReturns: totalReturns,
        totalApprovedWastage: totalWastage,
        currentInHandStock: currentStock,
        unaccountedLeakageQty: unaccountedLeakage,
        unitCostLkr: unitCost,
        leakageFinancialImpactLkr: leakageCost,
        auditAlertStatus,
        anomalousSODCount
      };
    });

    let contractorName: string | undefined;
    if (contractorId) {
      const c = await prisma.contractor.findUnique({
        where: { id: contractorId },
        select: { name: true }
      });
      contractorName = c?.name;
    }

    return {
      storeId,
      contractorId,
      contractorName,
      month,
      auditedAt: new Date(),
      totalConsumablesAudited: items.length,
      totalUnaccountedLeakageCostLkr: Math.round(totalUnaccountedLeakageCostLkr * 100) / 100,
      highRiskConsumableCount,
      items: auditItems
    };
  }
}
