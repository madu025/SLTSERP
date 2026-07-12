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

    const itemsCount = await prisma.inventoryItem.count();
    const storesCount = await prisma.inventoryStore.count();
    const lowStockItems = await prisma.inventoryStock.findMany({
      where: { quantity: { lte: 10 } },
      include: { item: true, store: true },
      take: 5
    });
    const expiringBatches = await prisma.inventoryBatch.findMany({
      where: {
        expiryDate: { lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), gt: today }
      },
      include: { item: true },
      take: 5
    });
    const custodyAssets = await prisma.inventoryItemSerial.findMany({
      where: { status: 'ASSIGNED' },
      include: { assignedStaff: true, item: true },
      take: 5
    });
    const activeProjectsCount = await prisma.project.count({ where: { status: 'IN_PROGRESS' } });
    const overdueTasksCount = await prisma.projectTask.count({
      where: { status: { in: ['PENDING', 'IN_PROGRESS'] }, plannedEndDate: { lt: today } }
    });
    const atRiskProjects = await prisma.project.findMany({
      where: { status: 'IN_PROGRESS', actualCost: { gt: 0 } },
      select: { id: true, name: true, projectCode: true, progress: true },
      take: 3
    });
    const outstandingInvoices = await prisma.invoice.aggregate({
      _sum: { totalAmount: true },
      where: { status: { notIn: ['PAID', 'CANCELLED', 'REJECTED'] } }
    });
    const pendingPVs = await prisma.paymentVoucher.count({ where: { status: 'PENDING_APPROVAL' } });
    const totalRetentionHeld = await prisma.projectRetention.aggregate({
      _sum: { balanceAmount: true },
      where: { status: { not: 'FULLY_RELEASED' } }
    });
    const activePenalties = await prisma.projectLDPenalty.aggregate({
      _sum: { netAmount: true },
      where: { status: 'APPROVED' }
    });
    const pendingPRs = await prisma.projectRequisition.count({ where: { status: 'DRAFT' } });
    const pendingPOs = await prisma.projectPurchaseOrder.count({ where: { status: 'PENDING_APPROVAL' } });
    const pendingGRNs = await prisma.projectGoodsReceipt.count({ where: { status: 'PENDING' } });
    const contractorsCount = await prisma.contractor.count();
    const releasableInvoices = await prisma.invoice.findMany({
      where: {
        statusB: 'HOLD',
        sods: { every: { hoPatStatus: 'PAT_PASSED' } }
      },
      select: { invoiceNumber: true, amountB: true }
    });
    const activeProjects = await prisma.project.findMany({
      where: { status: 'IN_PROGRESS' },
      select: { id: true, name: true },
      take: 5
    });
    const bomContext = await this.getBOMInvoicesContext();

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
      contractorsCount: contractorsCount,
      bomInvoices: bomContext
    };
  }

  // --- MODULAR INTENT-DRIVEN QUERY FUNCTIONS ---

  static async getFinanceContext() {
    const [outstandingInvoices, pendingPVs, releasableInvoices, outstandingInvoicesList] = await Promise.all([
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
      }),
      prisma.invoice.findMany({
        where: { status: { notIn: ['PAID', 'CANCELLED', 'REJECTED'] } },
        select: { invoiceNumber: true, totalAmount: true, status: true },
        take: 10,
        orderBy: { createdAt: 'desc' }
      })
    ]);

    const releasableTotal = releasableInvoices.reduce((sum, inv) => sum + Number(inv.amountB || 0), 0);

    return {
      outstandingInvoicesSum: outstandingInvoices._sum.totalAmount || 0,
      pendingPVsCount: pendingPVs,
      releasableRetentionsCount: releasableInvoices.length,
      releasableRetentionsSum: releasableTotal,
      releasableInvoicesList: releasableInvoices.map(i => `${i.invoiceNumber} (LKR ${Number(i.amountB).toLocaleString()})`),
      outstandingInvoicesList: outstandingInvoicesList.map(i => ({
        invoiceNumber: i.invoiceNumber,
        totalAmount: Number(i.totalAmount),
        status: i.status
      }))
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
        select: { id: true, name: true, projectCode: true, progress: true },
        take: 10
      })
    ]);

    const projectRisks = [];
    for (const p of activeProjects) {
        const risk = await ProjectAIService.predictProjectRisks(p.id);
        if (risk.risks.length > 0) {
            projectRisks.push({ name: p.name, risks: risk.risks });
        }
    }

    return { 
      activeProjectsCount, 
      overdueTasksCount, 
      projectRisks,
      activeProjectsList: activeProjects.map(p => ({
        id: p.id,
        name: p.name,
        projectCode: p.projectCode,
        progress: Number(p.progress || 0)
      }))
    };
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
      prisma.contractor.findMany({ select: { id: true, name: true, type: true }, take: 20, orderBy: { name: 'asc' } })
    ]);
    return {
      contractorsCount,
      list: contractors.map(c => `${c.name} (${c.type})`),
      contractorsList: contractors.map(c => ({ name: c.name, type: c.type }))
    };
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
      prisma.inventoryItem.findMany({ select: { name: true, code: true, unit: true }, take: 20, orderBy: { name: 'asc' } })
    ]);
    return {
      itemsCount,
      list: items.map(i => `${i.name} [${i.code}]`),
      itemsList: items.map(i => ({ name: i.name, code: i.code, unit: i.unit || 'N/A' }))
    };
  }

  static async getProcurementContext() {
    const [pendingPRs, pendingPOs, pendingGRNs, poList] = await Promise.all([
      prisma.projectRequisition.count({ where: { status: 'DRAFT' } }),
      prisma.projectPurchaseOrder.count({ where: { status: 'PENDING_APPROVAL' } }),
      prisma.projectGoodsReceipt.count({ where: { status: 'PENDING' } }),
      prisma.projectPurchaseOrder.findMany({
        where: { status: 'PENDING_APPROVAL' },
        select: { poNumber: true, totalAmount: true, status: true },
        take: 10,
        orderBy: { createdAt: 'desc' }
      })
    ]);
    return {
      pendingPRsCount: pendingPRs,
      pendingPOsCount: pendingPOs,
      pendingGRNsCount: pendingGRNs,
      pendingPOList: poList.map(p => ({
        poNumber: p.poNumber,
        totalAmount: Number(p.totalAmount || 0),
        status: p.status
      }))
    };
  }

  static async getVouchersContext() {
    const [pendingPVs, pvList] = await Promise.all([
      prisma.paymentVoucher.count({ where: { status: 'PENDING_APPROVAL' } }),
      prisma.paymentVoucher.findMany({
        where: { status: 'PENDING_APPROVAL' },
        select: { pvNumber: true, amount: true, status: true, payeeName: true },
        take: 10,
        orderBy: { createdAt: 'desc' }
      })
    ]);
    return {
      pendingPVsCount: pendingPVs,
      pendingVouchersList: pvList.map(v => ({
        pvNumber: v.pvNumber,
        amount: Number(v.amount || 0),
        status: v.status,
        payeeName: v.payeeName
      }))
    };
  }

  static async getBOMInvoicesContext() {
    const [bomInvoicesCount, bomRevenue, recentBOMInvoices, syncedSODsCount, rtomMismatches] = await Promise.all([
      prisma.invoice.count({ where: { bomNumber: { not: null } } }),
      prisma.invoice.aggregate({
        _sum: { totalAmount: true },
        where: { bomNumber: { not: null } }
      }),
      prisma.invoice.findMany({
        where: { bomNumber: { not: null } },
        select: {
          id: true,
          invoiceNumber: true,
          totalAmount: true,
          rtomArea: true,
          bomNumber: true,
          year: true,
          month: true,
          status: true
        },
        orderBy: { createdAt: 'desc' },
        take: 5
      }),
      prisma.serviceOrder.count({
        where: { invoice: { bomNumber: { not: null } } }
      }),
      this.getRTOMMismatchesContext()
    ]);

    return {
      bomInvoicesCount,
      bomRevenueSum: bomRevenue._sum.totalAmount || 0,
      syncedSODsCount,
      recentBOMInvoices: recentBOMInvoices.map(i => `${i.invoiceNumber} (${i.rtomArea || 'GLOBAL'}, ${i.month}/${i.year}) - LKR ${i.totalAmount.toLocaleString()} [${i.status}]`),
      rtomMismatches
    };
  }

  static async getRTOMMismatchesContext() {
    const sods = await prisma.serviceOrder.findMany({
        where: {
            invoice: { bomNumber: { not: null } }
        },
        select: {
            rtom: true,
            materialUsage: {
                select: {
                    quantity: true,
                    usageType: true,
                    item: {
                        select: { code: true, name: true }
                    }
                }
            }
        }
    });

    const rtomStats: Record<string, {
        rtom: string;
        totalSODsCount: number;
        mismatchedSODsCount: number;
        itemMismatches: Record<string, { name: string; local: number; bom: number }>;
    }> = {};

    sods.forEach(sod => {
        const rtom = sod.rtom || 'GLOBAL';
        if (!rtomStats[rtom]) {
            rtomStats[rtom] = {
                rtom,
                totalSODsCount: 0,
                mismatchedSODsCount: 0,
                itemMismatches: {}
            };
        }
        rtomStats[rtom].totalSODsCount++;

        const itemMap: Record<string, { name: string; local: number; bom: number }> = {};
        sod.materialUsage.forEach(u => {
            const code = u.item.code;
            if (!itemMap[code]) {
                itemMap[code] = { name: u.item.name, local: 0, bom: 0 };
            }
            if (u.usageType === 'BOM_CLAIM') {
                itemMap[code].bom += u.quantity;
            } else {
                itemMap[code].local += u.quantity;
            }
        });

        let isMismatched = false;
        Object.entries(itemMap).forEach(([code, counts]) => {
            if (Math.abs(counts.local - counts.bom) > 0.001) {
                isMismatched = true;
                if (!rtomStats[rtom].itemMismatches[code]) {
                    rtomStats[rtom].itemMismatches[code] = { name: counts.name, local: 0, bom: 0 };
                }
                rtomStats[rtom].itemMismatches[code].local += counts.local;
                rtomStats[rtom].itemMismatches[code].bom += counts.bom;
            }
        });

        if (isMismatched) {
            rtomStats[rtom].mismatchedSODsCount++;
        }
    });

    return Object.values(rtomStats).map(stat => {
        let topItemCode = 'None';
        let maxDiff = 0;
        Object.entries(stat.itemMismatches).forEach(([code, counts]) => {
            const diff = Math.abs(counts.local - counts.bom);
            if (diff > maxDiff) {
                maxDiff = diff;
                topItemCode = `${counts.name} (${code}) [Diff: ${diff.toFixed(0)}]`;
            }
        });

        return {
            rtom: stat.rtom,
            totalSODs: stat.totalSODsCount,
            mismatchedSODs: stat.mismatchedSODsCount,
            accuracyRate: stat.totalSODsCount > 0 
                ? parseFloat(((1 - stat.mismatchedSODsCount / stat.totalSODsCount) * 100).toFixed(1)) 
                : 100.0,
            topMismatchedItem: topItemCode
        };
    }).sort((a, b) => b.mismatchedSODs - a.mismatchedSODs);
  }

  static async getSummaryContext() {
    const today = new Date();
    const [
      itemsCount,
      storesCount,
      activeProjectsCount,
      overdueTasksCount,
      pendingPVsCount,
      contractorsCount
    ] = await Promise.all([
      prisma.inventoryItem.count(),
      prisma.inventoryStore.count(),
      prisma.project.count({ where: { status: 'IN_PROGRESS' } }),
      prisma.projectTask.count({
        where: { status: { in: ['PENDING', 'IN_PROGRESS'] }, plannedEndDate: { lt: today } }
      }),
      prisma.paymentVoucher.count({ where: { status: 'PENDING_APPROVAL' } }),
      prisma.contractor.count()
    ]);

    return {
      inventory: {
        itemsCount,
        storesCount
      },
      projects: {
        activeProjectsCount,
        overdueTasksCount
      },
      finance: {
        pendingPVsCount
      },
      contractorsCount
    };
  }
}
