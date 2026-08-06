import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { NIL_UUID } from '@/lib/opmc-scope';

export class DashboardService {
    static async getFinanceMetrics(rtom: string = 'ALL', accessibleOpmcs?: string[]) {
        // Tri-state regional scope: undefined = admin/global; [] = deny all.
        // A client-supplied rtom outside the caller's scope yields no data.
        let scopedRtoms: string[] | undefined;
        if (accessibleOpmcs !== undefined) {
            scopedRtoms = accessibleOpmcs.length > 0
                ? (await prisma.oPMC.findMany({ where: { id: { in: accessibleOpmcs } }, select: { rtom: true } })).map(o => o.rtom)
                : [];
            // When the caller is scoped and the requested rtom is in scope,
            // collapse to exactly that rtom instead of aggregating every
            // accessible rtom; out-of-scope requests yield an empty set.
            if (rtom !== 'ALL') {
                scopedRtoms = scopedRtoms.includes(rtom) ? [rtom] : [];
            }
        }

        const whereClause: Record<string, unknown> = {};
        if (scopedRtoms !== undefined) {
            whereClause.rtom = { in: scopedRtoms };
        } else if (rtom !== 'ALL') {
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
        if (scopedRtoms !== undefined) {
            invoiceWhere.rtomArea = { in: scopedRtoms };
        } else if (rtom !== 'ALL') {
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

    static async getInventoryMetrics(rtom: string = 'ALL', accessibleOpmcs?: string[]) {
        // Get Stores matching Region/RTOM logic, intersected with the caller's
        // OPMC scope (tri-state): undefined = admin/global; [] = deny all.
        const storeWhere: Prisma.InventoryStoreWhereInput = {};
        const opmcConditions: Prisma.OPMCWhereInput[] = [];
        if (rtom !== 'ALL') {
            opmcConditions.push({ rtom });
        }
        if (accessibleOpmcs !== undefined) {
            opmcConditions.push(accessibleOpmcs.length > 0 ? { id: { in: accessibleOpmcs } } : { id: NIL_UUID });
        }
        if (opmcConditions.length === 1) {
            storeWhere.opmcs = { some: opmcConditions[0] };
        } else if (opmcConditions.length > 1) {
            storeWhere.opmcs = { some: { AND: opmcConditions } };
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

    static async getProcurementMetrics(rtom: string = 'ALL', accessibleOpmcs?: string[]) {
        // Tri-state OPMC scope: undefined = admin/global; [] = deny all.
        const storeWhere: Prisma.InventoryStoreWhereInput = {};
        const opmcConditions: Prisma.OPMCWhereInput[] = [];
        if (rtom !== 'ALL') {
            opmcConditions.push({ rtom });
        }
        if (accessibleOpmcs !== undefined) {
            opmcConditions.push(accessibleOpmcs.length > 0 ? { id: { in: accessibleOpmcs } } : { id: NIL_UUID });
        }
        if (opmcConditions.length === 1) {
            storeWhere.opmcs = { some: opmcConditions[0] };
        } else if (opmcConditions.length > 1) {
            storeWhere.opmcs = { some: { AND: opmcConditions } };
        }

        const [
            pendingPRNs,
            openPOs,
            completedPOs,
            pendingGRNsCount,
            lowStockItems,
            recentPendingRequests,
            recentActivePOs
        ] = await Promise.all([
            // 1. Pending PRNs awaiting PO creation
            prisma.stockRequest.count({
                where: {
                    workflowStage: { in: ['PROCUREMENT_PROCESSING', 'PROCUREMENT'] },
                    procurementStatus: 'PENDING'
                }
            }),

            // 2. Open / Active POs in progress
            prisma.stockRequest.count({
                where: {
                    workflowStage: { in: ['PROCUREMENT_PROCESSING', 'PROCUREMENT'] },
                    procurementStatus: { in: ['PO_CREATED', 'PO_SENT', 'PO_CONFIRMED'] }
                }
            }),

            // 3. Completed Procurement Requests
            prisma.stockRequest.count({
                where: {
                    procurementStatus: 'COMPLETED'
                }
            }),

            // 4. Pending GRNs awaiting receipt intake
            prisma.stockRequest.count({
                where: {
                    workflowStage: { in: ['GRN_PENDING', 'STORE_RECEIVING'] }
                }
            }),

            // 5. Critical Stock Outages (Low Stock)
            prisma.inventoryStock.findMany({
                where: {
                    store: storeWhere,
                    quantity: { lte: 10 }
                },
                select: {
                    quantity: true,
                    item: { select: { id: true, name: true, code: true, unit: true } },
                    store: { select: { id: true, name: true } }
                },
                orderBy: { quantity: 'asc' },
                take: 6
            }),

            // 6. Recent Pending Requests (Requisitions Needing PO)
            prisma.stockRequest.findMany({
                where: {
                    workflowStage: { in: ['PROCUREMENT_PROCESSING', 'PROCUREMENT'] },
                    procurementStatus: 'PENDING'
                },
                select: {
                    id: true,
                    requestNr: true,
                    priority: true,
                    createdAt: true,
                    status: true,
                    workflowStage: true,
                    requestedBy: { select: { id: true, name: true } },
                    toStore: { select: { id: true, name: true } },
                    _count: { select: { items: true } }
                },
                orderBy: { createdAt: 'desc' },
                take: 5
            }),

            // 7. Recent Active POs
            prisma.stockRequest.findMany({
                where: {
                    workflowStage: { in: ['PROCUREMENT_PROCESSING', 'PROCUREMENT'] },
                    procurementStatus: { in: ['PO_CREATED', 'PO_SENT', 'PO_CONFIRMED'] }
                },
                select: {
                    id: true,
                    requestNr: true,
                    procurementStatus: true,
                    createdAt: true,
                    requestedBy: { select: { id: true, name: true } },
                    _count: { select: { items: true } },
                    purchaseOrders: {
                        select: {
                            poNumber: true,
                            vendor: true,
                            expectedDelivery: true
                        }
                    }
                },
                orderBy: { createdAt: 'desc' },
                take: 5
            })
        ]);

        const mappedRecentActivePOs = recentActivePOs.map(prn => ({
            ...prn,
            poNumber: prn.purchaseOrders.map(po => po.poNumber).join(', '),
            vendor: prn.purchaseOrders.map(po => po.vendor).join(', '),
            expectedDelivery: prn.purchaseOrders.find(po => po.expectedDelivery)?.expectedDelivery || null
        }));

        return {
            pendingPRNs,
            openPOs,
            completedPOs,
            pendingGRNs: pendingGRNsCount,
            lowStockItems,
            recentPendingRequests,
            recentActivePOs: mappedRecentActivePOs,
            updatedAt: new Date().toISOString()
        };
    }
}

