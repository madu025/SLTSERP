import { primaryClient as prisma } from '@/lib/prisma';
import { ProjectAIService } from './project/project-ai.service';

export class NexusContextService {
  /**
   * Generates a unified, multi-module context object for the Gemini model prompt.
   * NOTE: This is kept for backward compatibility and for full LLM passes. 
   * Local intent fallbacks should use the modular fetchers below.
   */
  static async getContext() {
    const today = new Date();

    const [
      itemsCount,
      storesCount,
      lowStockItems,
      expiringBatches,
      custodyAssets,
      activeProjectsCount,
      overdueTasksCount,
      atRiskProjects,
      outstandingInvoices,
      pendingPVs,
      totalRetentionHeld,
      activePenalties,
      pendingPRs,
      pendingPOs,
      pendingGRNs,
      contractorsCount,
      releasableInvoices,
      activeProjects
    ] = await Promise.all([
      prisma.inventoryItem.count(),
      prisma.inventoryStore.count(),
      prisma.inventoryStock.findMany({
        where: { quantity: { lte: 10 } },
        include: { item: true, store: true },
        take: 5
      }),
      prisma.inventoryBatch.findMany({
        where: {
          expiryDate: { lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), gt: today }
        },
        include: { item: true },
        take: 5
      }),
      prisma.inventoryItemSerial.findMany({
        where: { status: 'ASSIGNED' },
        include: { assignedStaff: true, item: true },
        take: 5
      }),
      prisma.project.count({ where: { status: 'IN_PROGRESS' } }),
      prisma.projectTask.count({
        where: { status: { in: ['PENDING', 'IN_PROGRESS'] }, plannedEndDate: { lt: today } }
      }),
      prisma.project.findMany({
        where: { status: 'IN_PROGRESS', actualCost: { gt: 0 } },
        select: { id: true, name: true, projectCode: true, progress: true },
        take: 3
      }),
      prisma.invoice.aggregate({
        _sum: { totalAmount: true },
        where: { status: { notIn: ['PAID', 'CANCELLED', 'REJECTED'] } }
      }),
      prisma.paymentVoucher.count({ where: { status: 'PENDING_APPROVAL' } }),
      prisma.projectRetention.aggregate({
        _sum: { balanceAmount: true },
        where: { status: { not: 'FULLY_RELEASED' } }
      }),
      prisma.projectLDPenalty.aggregate({
        _sum: { netAmount: true },
        where: { status: 'APPROVED' }
      }),
      prisma.projectRequisition.count({ where: { status: 'DRAFT' } }),
      prisma.projectPurchaseOrder.count({ where: { status: 'PENDING_APPROVAL' } }),
      prisma.projectGoodsReceipt.count({ where: { status: 'PENDING' } }),
      prisma.contractor.count(),
      prisma.invoice.findMany({
        where: {
          statusB: 'HOLD',
          sods: { every: { hoPatStatus: 'PAT_PASSED' } }
        },
        select: { invoiceNumber: true, amountB: true }
      }),
      prisma.project.findMany({
        where: { status: 'IN_PROGRESS' },
        select: { id: true, name: true },
        take: 5
      })
    ]);

    const projectRisks = [];
    for (const p of activeProjects) {
        const risk = await ProjectAIService.predictProjectRisks(p.id);
        if (risk.risks.length > 0) {
            projectRisks.push({ name: p.name, risks: risk.risks });
        }
    }

    const releasableTotal = releasableInvoices.reduce((sum, inv) => sum + Number(inv.amountB || 0), 0);

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
        })),
        projectRisks
      },
      finance: {
        outstandingInvoicesSum: outstandingInvoices._sum.totalAmount || 0,
        pendingPVsCount: pendingPVs,
        totalRetentionHeld: totalRetentionHeld._sum.balanceAmount || 0,
        activePenaltiesSum: activePenalties._sum.netAmount || 0,
        releasableRetentionsCount: releasableInvoices.length,
        releasableRetentionsSum: releasableTotal,
        releasableInvoicesList: releasableInvoices.map(i => `${i.invoiceNumber} (LKR ${Number(i.amountB).toLocaleString()})`)
      },
      procurement: {
        pendingPRsCount: pendingPRs,
        pendingPOsCount: pendingPOs,
        pendingGRNsCount: pendingGRNs
      },
      contractorsCount: contractorsCount
    };
  }

  // --- MODULAR INTENT-DRIVEN QUERY FUNCTIONS ---

  static async getFinanceContext() {
    const [outstandingInvoices, pendingPVs, releasableInvoices] = await Promise.all([
      prisma.invoice.aggregate({
        _sum: { totalAmount: true },
        where: { status: { notIn: ['PAID', 'CANCELLED', 'REJECTED'] } }
      }),
      prisma.paymentVoucher.count({ where: { status: 'PENDING_APPROVAL' } }),
      prisma.invoice.findMany({
        where: {
          statusB: 'HOLD',
          sods: {
            every: {
              hoPatStatus: 'PAT_PASSED'
            }
          }
        },
        select: {
          id: true,
          invoiceNumber: true,
          amountB: true
        }
      })
    ]);

    const releasableTotal = releasableInvoices.reduce((sum, inv) => sum + Number(inv.amountB || 0), 0);

    return {
      outstandingInvoicesSum: outstandingInvoices._sum.totalAmount || 0,
      pendingPVsCount: pendingPVs,
      releasableRetentionsCount: releasableInvoices.length,
      releasableRetentionsSum: releasableTotal,
      releasableInvoicesList: releasableInvoices.map(i => `${i.invoiceNumber} (LKR ${Number(i.amountB).toLocaleString()})`)
    };
  }

  static async getProjectsContext() {
    const today = new Date();
    const [activeProjectsCount, overdueTasksCount, activeProjects] = await Promise.all([
      prisma.project.count({ where: { status: 'IN_PROGRESS' } }),
      prisma.projectTask.count({
        where: { status: { in: ['PENDING', 'IN_PROGRESS'] }, plannedEndDate: { lt: today } }
      }),
      prisma.project.findMany({
        where: { status: 'IN_PROGRESS' },
        select: { id: true, name: true },
        take: 5
      })
    ]);

    const projectRisks = [];
    for (const p of activeProjects) {
        const risk = await ProjectAIService.predictProjectRisks(p.id);
        if (risk.risks.length > 0) {
            projectRisks.push({ name: p.name, risks: risk.risks });
        }
    }

    return { activeProjectsCount, overdueTasksCount, projectRisks };
  }

  static async getInventoryLowStockContext() {
    const lowStockItems = await prisma.inventoryStock.findMany({
      where: { quantity: { lte: 10 } }, // Alternatively, use minLevel checks if available
      include: { item: true, store: true },
      take: 20
    });
    return {
      lowStock: lowStockItems.map(s => ({
        itemId: s.itemId,
        storeId: s.storeId,
        itemName: s.item?.name || 'Unknown',
        itemCode: s.item?.code || '',
        storeName: s.store?.name || '',
        qty: Number(s.quantity),
        min: Number(s.minLevel || 10)
      }))
    };
  }

  static async getContractorsContext() {
    const [contractorsCount, contractors] = await Promise.all([
      prisma.contractor.count(),
      prisma.contractor.findMany({ select: { name: true, type: true }, take: 5 })
    ]);
    return { contractorsCount, list: contractors.map(c => `${c.name} (${c.type})`) };
  }

  static async getStoresContext() {
    const [storesCount, stores] = await Promise.all([
      prisma.inventoryStore.count(),
      prisma.inventoryStore.findMany({ 
        select: { name: true, type: true, location: true } 
      })
    ]);
    return { 
      storesCount, 
      list: stores.map(s => `${s.name} (${s.type}) - Location: ${s.location || 'Unknown'}`) 
    };
  }

  static async getInventoryItemsContext() {
    const [itemsCount, items] = await Promise.all([
      prisma.inventoryItem.count(),
      prisma.inventoryItem.findMany({ select: { name: true, code: true }, take: 5 })
    ]);
    return { itemsCount, list: items.map(i => `${i.name} [${i.code}]`) };
  }

  static async getProcurementContext() {
    const [pendingPRs, pendingPOs, pendingGRNs] = await Promise.all([
      prisma.projectRequisition.count({ where: { status: 'DRAFT' } }),
      prisma.projectPurchaseOrder.count({ where: { status: 'PENDING_APPROVAL' } }),
      prisma.projectGoodsReceipt.count({ where: { status: 'PENDING' } })
    ]);
    return {
      pendingPRsCount: pendingPRs,
      pendingPOsCount: pendingPOs,
      pendingGRNsCount: pendingGRNs
    };
  }

  static async getVouchersContext() {
    const pendingPVs = await prisma.paymentVoucher.count({ where: { status: 'PENDING_APPROVAL' } });
    return { pendingPVsCount: pendingPVs };
  }
}
