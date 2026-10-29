import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { NIL_UUID } from '@/lib/opmc-scope';
import { SOD_FINANCIAL_COMPLETION_STATUSES } from '@/lib/constants/sod-constants';

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

        // Financial dashboards use the same completion rule as WIP and invoice
        // services. A SOD may carry the portal completion in sltsStatus or the
        // ERP completion in status, so checking only one column under-counts
        // completed work and makes the dashboard disagree with finance.
        const financialCompletionWhere: Prisma.ServiceOrderWhereInput = {
            OR: [
                { sltsStatus: { in: [...SOD_FINANCIAL_COMPLETION_STATUSES] } },
                { status: { in: [...SOD_FINANCIAL_COMPLETION_STATUSES] } }
            ]
        };

        // Finance rows must remain inside the caller's OPMC scope even when
        // their RTOM value is shared with another OPMC. Global/admin scope is
        // represented by undefined; an empty resolved scope denies all rows.
        const serviceOrderOpmcScope: Prisma.ServiceOrderWhereInput = accessibleOpmcs === undefined
            ? {}
            : { opmcId: { in: accessibleOpmcs } };

        const invoiceOpmcScope: Prisma.InvoiceWhereInput | undefined = accessibleOpmcs === undefined
            ? undefined
            : {
                OR: [
                    { project: { opmcId: { in: accessibleOpmcs } } },
                    { sods: { some: { opmcId: { in: accessibleOpmcs } } } }
                ]
            };

        const invoiceWhere: Prisma.InvoiceWhereInput = {};
        if (scopedRtoms !== undefined) {
            invoiceWhere.rtomArea = { in: scopedRtoms };
        } else if (rtom !== 'ALL') {
            invoiceWhere.rtomArea = rtom;
        }
        if (invoiceOpmcScope) {
            invoiceWhere.AND = [invoiceOpmcScope];
        }

        // 1. Unbilled WIP Revenue (Service Orders Completed but not invoiced)
        const [wipSods, pendingInvoicesA, pendingInvoicesB] = await Promise.all([
            prisma.serviceOrder.aggregate({
                where: {
                    AND: [
                        whereClause,
                        serviceOrderOpmcScope,
                        financialCompletionWhere,
                        { revenueAmount: { not: null } },
                        { contractorAmount: { not: null } }
                    ],
                    invoiced: false,
                    invoiceId: null
                },
                _sum: {
                    revenueAmount: true,
                    contractorAmount: true
                }
            }),
            prisma.invoice.aggregate({
                where: {
                    ...invoiceWhere,
                    statusA: 'PENDING'
                },
                _sum: {
                    amountA: true
                }
            }),
            prisma.invoice.aggregate({
                where: {
                    ...invoiceWhere,
                    statusB: { in: ['HOLD', 'PENDING'] }
                },
                _sum: {
                    amountB: true
                }
            })
        ]);

        const unbilledRevenue = wipSods._sum.revenueAmount || 0;
        const unbilledContractorPayout = wipSods._sum.contractorAmount || 0;

        const pendingPayoutA = Number(pendingInvoicesA._sum.amountA || 0);
        const pendingPayoutB = Number(pendingInvoicesB._sum.amountB || 0);

        const totalPendingPayouts = pendingPayoutA + pendingPayoutB + Number(unbilledContractorPayout);

        // 3. Monthly Revenue Trend (last 6 months, from completed Service Orders)
        const trendStart = new Date();
        trendStart.setMonth(trendStart.getMonth() - 5, 1);
        trendStart.setHours(0, 0, 0, 0);

        const [completedSods, outstandingInvoices] = await Promise.all([
            prisma.serviceOrder.findMany({
                where: {
                    AND: [whereClause, serviceOrderOpmcScope, financialCompletionWhere],
                    completedDate: { gte: trendStart },
                    revenueAmount: { not: null }
                },
                select: { completedDate: true, revenueAmount: true }
            }),
            prisma.invoice.findMany({
                where: {
                    ...invoiceWhere,
                    OR: [
                        { statusA: 'PENDING' },
                        { statusB: { in: ['HOLD', 'PENDING'] } }
                    ]
                },
                select: { date: true, dueDate: true, createdAt: true, amountA: true, amountB: true, statusA: true, statusB: true }
            })
        ]);

        const now = new Date();
        const trendBuckets: { month: string; year: number; revenue: number; count: number }[] = [];
        const trendMap = new Map<string, { month: string; year: number; revenue: number; count: number }>();
        for (let i = 5; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const bucket = {
                month: d.toLocaleString('en-US', { month: 'short' }),
                year: d.getFullYear(),
                revenue: 0,
                count: 0
            };
            trendBuckets.push(bucket);
            trendMap.set(`${d.getFullYear()}-${d.getMonth()}`, bucket);
        }
        for (const sod of completedSods) {
            if (!sod.completedDate) continue;
            const bucket = trendMap.get(`${sod.completedDate.getFullYear()}-${sod.completedDate.getMonth()}`);
            if (bucket) {
                bucket.revenue += Number(sod.revenueAmount || 0);
                bucket.count += 1;
            }
        }
        const revenueTrend = trendBuckets.map(b => ({ month: b.month, year: b.year, revenue: b.revenue, count: b.count }));

        // 4. Payment Aging Analysis (outstanding payout amounts by invoice age)
        const aging = { within30: 0, days31To60: 0, days61To90: 0, over90: 0 };
        const today = Date.now();
        for (const inv of outstandingInvoices) {
            const outstanding =
                (inv.statusA === 'PENDING' ? Number(inv.amountA || 0) : 0) +
                (inv.statusB === 'HOLD' || inv.statusB === 'PENDING' ? Number(inv.amountB || 0) : 0);
            if (outstanding <= 0) continue;
            // Aging is based on contractual due date when one exists. Legacy
            // invoices without a due date retain the creation/invoice-date
            // fallback so older records remain visible in the same buckets.
            const agingDate = inv.dueDate ?? inv.date ?? inv.createdAt;
            const ageDays = Math.floor((today - agingDate.getTime()) / (1000 * 60 * 60 * 24));
            if (ageDays <= 30) aging.within30 += outstanding;
            else if (ageDays <= 60) aging.days31To60 += outstanding;
            else if (ageDays <= 90) aging.days61To90 += outstanding;
            else aging.over90 += outstanding;
        }

        // 5. Invoice Status Breakdown (counts by statusA / statusB)
        const [statusAGroups, statusBGroups, invoiceTotals] = await Promise.all([
            prisma.invoice.groupBy({ by: ['statusA'], where: invoiceWhere, _count: { _all: true } }),
            prisma.invoice.groupBy({ by: ['statusB'], where: invoiceWhere, _count: { _all: true } }),
            prisma.invoice.aggregate({ where: invoiceWhere, _sum: { amount: true }, _avg: { amount: true }, _count: { _all: true } })
        ]);

        const invoiceStatusA: Record<string, number> = {};
        for (const g of statusAGroups) invoiceStatusA[g.statusA] = g._count._all;
        const invoiceStatusB: Record<string, number> = {};
        for (const g of statusBGroups) invoiceStatusB[g.statusB] = g._count._all;

        const totalInvoiced = Number(invoiceTotals._sum.amount || 0);
        const invoiceCount = invoiceTotals._count._all;
        const averageInvoiceAmount = Number(invoiceTotals._avg.amount || 0);

        const [invalidFinancialSnapshotCount, invalidInvoicableSnapshotCount] = await Promise.all([
            prisma.serviceOrder.count({
                where: {
                    AND: [
                        whereClause,
                        serviceOrderOpmcScope,
                        financialCompletionWhere,
                        { OR: [{ revenueAmount: null }, { contractorAmount: null }] }
                    ]
                }
            }),
            prisma.serviceOrder.count({
                where: {
                    AND: [
                        whereClause,
                        serviceOrderOpmcScope,
                        financialCompletionWhere,
                        { isInvoicable: true },
                        { OR: [{ revenueAmount: null }, { contractorAmount: null }] }
                    ]
                }
            })
        ]);

        return {
            unbilledRevenue,
            unbilledContractorPayout,
            pendingPayoutA,
            pendingPayoutB,
            totalPendingPayouts,
            revenueTrend,
            aging,
            invoiceStatusA,
            invoiceStatusB,
            totalInvoiced,
            invoiceCount,
            averageInvoiceAmount,
            dataQuality: {
                invalidFinancialSnapshotCount,
                invalidInvoicableSnapshotCount,
                wipRule: 'completed-status + revenueAmount + contractorAmount + not invoiced'
            },
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

        const projectOpmcConditions: Prisma.OPMCWhereInput[] = [];
        if (rtom !== 'ALL') projectOpmcConditions.push({ rtom });
        if (accessibleOpmcs !== undefined) {
            projectOpmcConditions.push({ id: { in: accessibleOpmcs.length > 0 ? accessibleOpmcs : [NIL_UUID] } });
        }
        const projectWhere: Prisma.ProjectWhereInput = projectOpmcConditions.length > 0
            ? { opmc: projectOpmcConditions.length === 1 ? projectOpmcConditions[0] : { AND: projectOpmcConditions } }
            : {};

        const [lowStockStock, pendingMRNs, pendingGRNs, negativeStockCount, materialUsageMissingCostCount] = await Promise.all([
            prisma.inventoryStock.findMany({
                where: {
                    store: storeWhere
                },
                include: {
                    item: { select: { name: true, code: true, minLevel: true } },
                    store: { select: { name: true } }
                },
            }),
            prisma.stockRequest.count({
                where: {
                    status: 'PENDING',
                    fromStore: storeWhere
                }
            }),
            prisma.projectGoodsReceipt.count({
                where: { status: 'PENDING', project: projectWhere }
            }),
            prisma.inventoryStock.count({
                where: {
                    store: storeWhere,
                    quantity: { lt: 0 }
                }
            }),
            prisma.sODMaterialUsage.count({
                where: {
                    // Match invoice validation and valuation: a positive unitPrice
                    // is a valid fallback when costPrice is unset/zero.
                    AND: [
                        { OR: [{ costPrice: null }, { costPrice: { lte: 0 } }] },
                        { OR: [{ unitPrice: null }, { unitPrice: { lte: 0 } }] }
                    ],
                    serviceOrder: {
                        ...(rtom !== 'ALL' ? { rtom } : {}),
                        ...(accessibleOpmcs !== undefined
                            ? { opmcId: { in: accessibleOpmcs.length > 0 ? accessibleOpmcs : [NIL_UUID] } }
                            : {})
                    }
                }
            })
        ]);

        const lowStockItems = lowStockStock
            .map(stock => {
                const quantity = Number(stock.quantity);
                const allocatedQuantity = Number(stock.allocatedQuantity);
                const minLevel = Number(stock.minLevel) > 0
                    ? Number(stock.minLevel)
                    : Number(stock.item.minLevel);
                return {
                    ...stock,
                    minLevel,
                    availableToPromise: Math.max(0, quantity - allocatedQuantity - minLevel),
                    availableQuantity: Math.max(0, quantity - allocatedQuantity),
                    _quantityForSort: quantity,
                    _isLowStock: quantity <= minLevel
                };
            })
            .filter(stock => stock._isLowStock)
            .sort((a, b) => a._quantityForSort - b._quantityForSort)
            .slice(0, 5)
            .map(({ _quantityForSort: ignoredSort, _isLowStock: ignoredLow, ...stock }) => {
                void ignoredSort;
                void ignoredLow;
                return stock;
            });

        return {
            lowStockItems,
            pendingMRNs,
            pendingGRNs,
            dataQuality: { negativeStockCount, materialUsageMissingCostCount },
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

        // External procurement requests are raised against the requesting
        // store (fromStore), while internal transfers target toStore. Include
        // either relationship so the same OPMC/RTOM scope applies to every
        // procurement metric without leaking requests from another office.
        const requestStoreScope: Prisma.StockRequestWhereInput = {
            OR: [
                { fromStore: storeWhere },
                { toStore: storeWhere }
            ]
        };

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
                    ...requestStoreScope,
                    workflowStage: { in: ['PROCUREMENT_PROCESSING', 'PROCUREMENT'] },
                    procurementStatus: 'PENDING'
                }
            }),

            // 2. Open / Active POs in progress
            prisma.stockRequest.count({
                where: {
                    ...requestStoreScope,
                    workflowStage: { in: ['PROCUREMENT_PROCESSING', 'PROCUREMENT'] },
                    procurementStatus: { in: ['PO_CREATED', 'PO_SENT', 'PO_CONFIRMED'] }
                }
            }),

            // 3. Completed Procurement Requests
            prisma.stockRequest.count({
                where: {
                    ...requestStoreScope,
                    procurementStatus: 'COMPLETED'
                }
            }),

            // 4. Pending GRNs awaiting receipt intake
            prisma.stockRequest.count({
                where: {
                    ...requestStoreScope,
                    workflowStage: { in: ['GRN_PENDING', 'STORE_RECEIVING'] }
                }
            }),

            // 5. Critical Stock Outages (Low Stock)
            prisma.inventoryStock.findMany({
                where: {
                    store: storeWhere
                },
                select: {
                    quantity: true,
                    allocatedQuantity: true,
                    minLevel: true,
                    item: { select: { id: true, name: true, code: true, unit: true, minLevel: true } },
                    store: { select: { id: true, name: true } }
                }
            }),

            // 6. Recent Pending Requests (Requisitions Needing PO)
            prisma.stockRequest.findMany({
                where: {
                    ...requestStoreScope,
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
                    ...requestStoreScope,
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

        const mappedLowStockItems = lowStockItems
            .map(stock => {
                const quantity = Number(stock.quantity);
                const allocatedQuantity = Number(stock.allocatedQuantity);
                const minLevel = Number(stock.minLevel) > 0
                    ? Number(stock.minLevel)
                    : Number(stock.item.minLevel);
                return {
                    ...stock,
                    minLevel,
                    availableToPromise: Math.max(0, quantity - allocatedQuantity - minLevel),
                    availableQuantity: Math.max(0, quantity - allocatedQuantity),
                    _quantityForSort: quantity,
                    _isLowStock: quantity <= minLevel
                };
            })
            .filter(stock => stock._isLowStock)
            .sort((a, b) => a._quantityForSort - b._quantityForSort)
            .slice(0, 6)
            .map(({ _quantityForSort: ignoredSort, _isLowStock: ignoredLow, ...stock }) => {
                void ignoredSort;
                void ignoredLow;
                return stock;
            });

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
            lowStockItems: mappedLowStockItems,
            recentPendingRequests,
            recentActivePOs: mappedRecentActivePOs,
            updatedAt: new Date().toISOString()
        };
    }
}

