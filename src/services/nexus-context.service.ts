import { prisma } from '@/lib/prisma';

export class NexusContextService {
  /**
   * Generates a unified, multi-module context object for the Gemini model prompt.
   */
  static async getContext() {
    const today = new Date();

    const [
      // Inventory metrics
      itemsCount,
      storesCount,
      lowStockItems,
      expiringBatches,
      custodyAssets,
      
      // Projects metrics
      activeProjectsCount,
      overdueTasksCount,
      atRiskProjects,
      
      // Finance metrics
      outstandingInvoices,
      pendingPVs,
      totalRetentionHeld,
      activePenalties,
      
      // Procurement metrics
      pendingPRs,
      pendingPOs,
      pendingGRNs
    ] = await Promise.all([
      // 1. Inventory Items & Stores
      prisma.inventoryItem.count(),
      prisma.inventoryStore.count(),
      prisma.inventoryStock.findMany({
        where: { quantity: { lte: 10 } },
        include: { item: true, store: true },
        take: 5
      }),
      prisma.inventoryBatch.findMany({
        where: {
          expiryDate: {
            lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            gt: today
          }
        },
        include: { item: true },
        take: 5
      }),
      prisma.inventoryItemSerial.findMany({
        where: { status: 'ASSIGNED' },
        include: { assignedStaff: true, item: true },
        take: 5
      }),

      // 2. Projects & Tasks
      prisma.project.count({ where: { status: 'IN_PROGRESS' } }),
      prisma.projectTask.count({
        where: {
          status: { in: ['PENDING', 'IN_PROGRESS'] },
          plannedEndDate: { lt: today }
        }
      }),
      prisma.project.findMany({
        where: {
          status: 'IN_PROGRESS',
          actualCost: { gt: 0 } // simple indicator of cost activity
        },
        select: { id: true, name: true, projectCode: true, progress: true },
        take: 3
      }),

      // 3. Finance
      prisma.invoice.aggregate({
        _sum: { totalAmount: true },
        where: { status: { notIn: ['PAID', 'CANCELLED', 'REJECTED'] } }
      }),
      prisma.paymentVoucher.count({
        where: { status: 'PENDING_APPROVAL' }
      }),
      prisma.projectRetention.aggregate({
        _sum: { balanceAmount: true },
        where: { status: { not: 'FULLY_RELEASED' } }
      }),
      prisma.projectLDPenalty.aggregate({
        _sum: { netAmount: true },
        where: { status: 'APPROVED' }
      }),

      // 4. Procurement
      prisma.projectRequisition.count({
        where: { status: 'DRAFT' } // PRs drafted but not approved
      }),
      prisma.projectPurchaseOrder.count({
        where: { status: 'PENDING_APPROVAL' }
      }),
      prisma.projectGoodsReceipt.count({
        where: { status: 'PENDING' }
      })
    ]);

    return {
      inventory: {
        itemsCount,
        storesCount,
        lowStock: lowStockItems.map(s => ({
          itemName: s.item?.name || 'Unknown',
          itemCode: s.item?.code || '',
          storeName: s.store?.name || '',
          qty: Number(s.quantity),
          min: Number(s.minLevel || 10)
        })),
        expiringBatches: expiringBatches.map(b => ({
          batchNumber: b.batchNumber,
          itemName: b.item?.name || 'Unknown',
          expiry: b.expiryDate?.toLocaleDateString() || 'N/A'
        })),
        custodyAssets: custodyAssets.map(c => ({
          serialNumber: c.serialNumber,
          itemName: c.item?.name || 'Unknown',
          staffName: c.assignedStaff?.name || 'Unknown'
        }))
      },
      projects: {
        activeProjectsCount,
        overdueTasksCount,
        atRiskProjects: atRiskProjects.map(p => ({
          code: p.projectCode,
          name: p.name,
          progress: Number(p.progress || 0)
        }))
      },
      finance: {
        outstandingInvoicesSum: outstandingInvoices._sum.totalAmount || 0,
        pendingPVsCount: pendingPVs,
        totalRetentionHeld: totalRetentionHeld._sum.balanceAmount || 0,
        activePenaltiesSum: activePenalties._sum.netAmount || 0
      },
      procurement: {
        pendingPRsCount: pendingPRs,
        pendingPOsCount: pendingPOs,
        pendingGRNsCount: pendingGRNs
      }
    };
  }
}
