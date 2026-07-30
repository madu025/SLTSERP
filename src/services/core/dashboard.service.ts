import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

export class DashboardService {
    static async getFinanceMetrics(rtom: string = 'ALL') {
        const whereClause: Record<string, unknown> = {};
        
        if (rtom !== 'ALL') {
            whereClause.rtom = rtom;
        }

        // 1. Unbilled WIP Revenue (Service Orders Completed but not invoiced)
        const wipSods = await prisma.serviceOrder.aggregate({
            where: {
                ...whereClause,
                sltsStatus: 'COMPLETED',
                invoiced: false,
                revenueAmount: { not: null }
            },
            _sum: {
                revenueAmount: true,
                contractorAmount: true
            }
        });

        const unbilledRevenue = wipSods._sum.revenueAmount || 0;
        const unbilledContractorPayout = wipSods._sum.contractorAmount || 0;

        // 2. Invoice Aging & Contractor Payouts (From Invoices)
        const invoiceWhere: Record<string, unknown> = {};
        if (rtom !== 'ALL') {
            invoiceWhere.rtomArea = rtom;
        }

        const pendingInvoicesA = await prisma.invoice.aggregate({
            where: {
                ...invoiceWhere,
                statusA: 'PENDING'
            },
            _sum: {
                amountA: true
            }
        });

        const pendingInvoicesB = await prisma.invoice.aggregate({
            where: {
                ...invoiceWhere,
                statusB: { in: ['HOLD', 'PENDING'] }
            },
            _sum: {
                amountB: true
            }
        });

        const pendingPayoutA = Number(pendingInvoicesA._sum.amountA || 0);
        const pendingPayoutB = Number(pendingInvoicesB._sum.amountB || 0);

        const totalPendingPayouts = pendingPayoutA + pendingPayoutB + Number(unbilledContractorPayout);

        return {
            unbilledRevenue,
            unbilledContractorPayout,
            pendingPayoutA,
            pendingPayoutB,
            totalPendingPayouts,
            updatedAt: new Date().toISOString()
        };
    }

    static async getInventoryMetrics(rtom: string = 'ALL') {
        // Get Stores matching Region/RTOM logic
        const storeWhere: Prisma.InventoryStoreWhereInput = {};
        if (rtom !== 'ALL') {
            storeWhere.opmcs = { some: { rtom: rtom } };
        }

        const lowStockItems = await prisma.inventoryStock.findMany({
            where: {
                store: storeWhere,
                quantity: { lte: 10 }
            },
            include: {
                item: { select: { name: true, code: true } },
                store: { select: { name: true } }
            },
            orderBy: { quantity: 'asc' },
            take: 5
        });

        const pendingMRNs = await prisma.stockRequest.count({
            where: {
                status: 'PENDING',
                fromStore: storeWhere
            }
        });

        const pendingGRNs = await prisma.projectGoodsReceipt.count({
            where: {
                status: 'PENDING',
            }
        });

        return {
            lowStockItems,
            pendingMRNs,
            pendingGRNs,
            updatedAt: new Date().toISOString()
        };
    }
}
