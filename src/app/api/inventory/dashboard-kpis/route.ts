import { apiHandler } from '@/lib/api-handler';
import { prisma } from '@/lib/prisma';
import { ROLE_GROUPS } from '@/config/roles';
import { NextResponse } from 'next/server';
import { StoreService } from '@/services/inventory/store.service';
export const dynamic = 'force-dynamic';
export const GET = apiHandler(async (req, params) => {
    const { searchParams } = new URL(req.url);
    let storeId = searchParams.get('storeId');
    const { _userRole, _userId } = params;
    const isGlobalManager = ['SUPER_ADMIN', 'ADMIN', 'STORES_MANAGER', 'OSP_MANAGER', 'AREA_MANAGER', 'MANAGER'].includes(_userRole || '');
    if (!isGlobalManager && _userId) {
        // Enforce store limit: assistants can only see their assigned store
        const user = await prisma.user.findUnique({ where: { id: _userId }, select: { assignedStoreId: true }});
        if (user?.assignedStoreId) {
            storeId = user.assignedStoreId;
        } else {
            // Unassigned assistant gets no data
            storeId = 'unassigned';
        }
    }
    const storeFilter = (storeId && storeId !== 'all' && storeId !== 'unassigned') 
        ? { storeId } 
        : {};
    // 1. Calculate Stock Valuation & Total Items
    // Use DB functions for single-store queries (zero egress computation)
    const singleStoreId = (storeId && storeId !== 'all' && storeId !== 'unassigned') ? storeId : null;
    let totalValue = 0;
    let totalQuantity = 0;
    let lowStockAlerts: Array<{ id: string; name: string; category: string | null; minLevel: number; currentQty: number }> = [];
    if (singleStoreId) {
        // Run all DB queries in parallel for single-store path
        // fn_store_dashboard_summary replaces 3 separate count queries (itemCount, totalValue, pendingMrnsCount)
        const [
            dashboardMetrics,
            alertRows,
            materialRows,
            expiringRows,
            pendingDispatches,
            pendingGrns
        ] = await Promise.all([
            StoreService.getDashboardSummary(singleStoreId),
            StoreService.getLowStockAlerts(singleStoreId),
            StoreService.getMaterialBalance(singleStoreId),
            StoreService.getExpiringBatches(singleStoreId, 30),
            prisma.stockRequest.findMany({
                where: { status: { in: ['PENDING', 'APPROVED'] }, fromStoreId: singleStoreId },
                take: 10, orderBy: { createdAt: 'desc' },
                select: {
                    id: true, requestNr: true, status: true, workflowStage: true, createdAt: true,
                    requestedBy: { select: { name: true } },
                    items: { select: { id: true, requestedQty: true, item: { select: { name: true } } } }
                }
            }),
            prisma.gRN.findMany({
                where: { storeId: singleStoreId },
                take: 10, orderBy: { createdAt: 'desc' },
                select: {
                    id: true, grnNumber: true, supplier: true, createdAt: true,
                    request: { select: { requestNr: true } },
                    purchaseOrder: { select: { poNumber: true, vendor: true } }
                }
            })
        ]);
        // Extract KPI metrics from single DB function call
        const metricsMap = new Map(dashboardMetrics.map(m => [m.metric_name, Number(m.metric_value) || 0]));
        totalValue = metricsMap.get('total_value') || 0;
        totalQuantity = metricsMap.get('total_quantity') || 0;
        const itemCount = metricsMap.get('total_unique_items') || 0;
        const pendingMrnsCount = metricsMap.get('pending_mrn_count') || 0;
        lowStockAlerts = alertRows.map(a => ({
            id: a.item_id,
            name: a.item_name,
            category: null,
            minLevel: Number(a.min_level) || 0,
            currentQty: Number(a.current_stock) || 0
        }));
        const materialBalance = materialRows.map(r => ({
            itemId: r.item_id,
            itemCode: r.item_code,
            itemName: r.item_name,
            currentStock: Number(r.current_stock) || 0,
            allocatedStock: Number(r.allocated_stock) || 0,
            availableStock: Number(r.available_stock) || 0,
            minLevel: Number(r.min_level) || 0,
            reorderNeeded: r.reorder_needed,
            totalValue: Number(r.total_value) || 0
        }));
        const expiringBatches = expiringRows.map(r => ({
            batchId: r.batch_id,
            batchNumber: r.batch_number,
            itemCode: r.item_code,
            itemName: r.item_name,
            quantity: Number(r.quantity) || 0,
            expiryDate: r.expiry_date,
            daysUntilExpiry: Number(r.days_until_expiry) || 0
        }));
        return NextResponse.json({
            success: true,
            summary: {
                totalStockValue: Math.round(totalValue),
                totalStockQuantity: totalQuantity,
                totalUniqueItems: itemCount,
                lowStockCount: lowStockAlerts.length,
                pendingDispatchCount: pendingDispatches.length,
                pendingGrnCount: pendingGrns.length,
                pendingMrnCount: pendingMrnsCount,
            },
            lowStockAlerts: lowStockAlerts.slice(0, 10),
            pendingDispatches,
            pendingGrns,
            materialBalance,
            expiringBatches,
        });
    }
    // Multi-store / global fallback: use JS computation
    const stocks = await prisma.inventoryStock.findMany({
        where: storeFilter,
        select: {
            quantity: true,
            item: {
                select: {
                    id: true,
                    name: true,
                    unitPrice: true,
                    minLevel: true,
                    category: true,
                }
            }
        }
    });
    const itemStockMap = new Map<string, { item: { id: string; name: string; unitPrice: number | null; minLevel: number; category: string | null; }; totalQty: number }>();
    for (const s of stocks) {
        const qty = Number(s.quantity) || 0;
        const price = s.item?.unitPrice ? Number(s.item.unitPrice) : 0;
        totalValue += qty * price;
        totalQuantity += qty;
        if (s.item) {
            const parsedItem = {
                id: s.item.id,
                name: s.item.name,
                unitPrice: s.item.unitPrice ? Number(s.item.unitPrice) : null,
                minLevel: Number(s.item.minLevel) || 0,
                category: s.item.category
            };
            const existing = itemStockMap.get(s.item.id) || { item: parsedItem, totalQty: 0 };
            existing.totalQty += qty;
            itemStockMap.set(s.item.id, existing);
        }
    }
    // Low stock items
    itemStockMap.forEach(({ item, totalQty }) => {
        if (item.minLevel > 0 && totalQty <= item.minLevel) {
            lowStockAlerts.push({
                id: item.id,
                name: item.name,
                category: item.category,
                minLevel: item.minLevel,
                currentQty: totalQty
            });
        }
    });
    // 2. Pending Contractor Dispatches (Stock Requests awaiting store issue)
    const pendingDispatches = await prisma.stockRequest.findMany({
        where: {
            status: { in: ['PENDING', 'APPROVED'] },
            ...(storeId && storeId !== 'all' && storeId !== 'unassigned' ? { fromStoreId: storeId } : {})
        },
        take: 10,
        orderBy: { createdAt: 'desc' },
        select: {
            id: true,
            requestNr: true,
            status: true,
            workflowStage: true,
            createdAt: true,
            requestedBy: {
                select: { name: true }
            },
            items: {
                select: {
                    id: true,
                    requestedQty: true,
                    item: { select: { name: true } }
                }
            }
        }
    });
    // 3. Awaiting GRNs
    const pendingGrns = await prisma.gRN.findMany({
        where: storeFilter,
        take: 10,
        orderBy: { createdAt: 'desc' },
        select: {
            id: true,
            grnNumber: true,
            supplier: true,
            createdAt: true,
            request: {
                select: {
                    requestNr: true,
                }
            },
            purchaseOrder: {
                select: {
                    poNumber: true,
                    vendor: true
                }
            }
        }
    });
    // 4. Pending MRNs (Returns)
    const pendingMrnsCount = await prisma.mRN.count({
        where: {
            status: 'PENDING',
            ...storeFilter
        }
    });
    // 5. Material Balance & Expiring Batches for multi-store view
    // Use single DB function calls instead of N+1 per-store loop
    const stores = await prisma.inventoryStore.findMany({
        where: storeFilter as any,
        select: { id: true }
    });
    const storeIds = stores.map(s => s.id);
    let materialBalance: Array<{
        itemId: string;
        itemCode: string;
        itemName: string;
        currentStock: number;
        allocatedStock: number;
        availableStock: number;
        minLevel: number;
        reorderNeeded: boolean;
        totalValue: number;
    }> = [];
    let expiringBatches: Array<{
        batchId: string;
        batchNumber: string;
        itemCode: string;
        itemName: string;
        quantity: number;
        expiryDate: Date;
        daysUntilExpiry: number;
    }> = [];
    if (storeIds.length > 0) {
        // Single DB call for all stores (replaces N+1 loop)
        const [matRows, expRows] = await Promise.all([
            StoreService.getMultiStoreMaterialBalance(storeIds),
            StoreService.getMultiStoreExpiringBatches(storeIds, 30)
        ]);
        materialBalance = matRows.map(r => ({
            itemId: r.item_id,
            itemCode: r.item_code,
            itemName: r.item_name,
            currentStock: Number(r.current_stock) || 0,
            allocatedStock: Number(r.allocated_stock) || 0,
            availableStock: Number(r.available_stock) || 0,
            minLevel: Number(r.min_level) || 0,
            reorderNeeded: r.reorder_needed,
            totalValue: Number(r.total_value) || 0
        }));
        expiringBatches = expRows.map(r => ({
            batchId: r.batch_id,
            batchNumber: r.batch_number,
            itemCode: r.item_code,
            itemName: r.item_name,
            quantity: Number(r.quantity) || 0,
            expiryDate: r.expiry_date,
            daysUntilExpiry: Number(r.days_until_expiry) || 0
        }));
    }
    // Override totalValue with PO-cost-based valuation from DB functions
    // (the JS fallback above uses InventoryItem.unitPrice which may be 0)
    if (materialBalance.length > 0) {
        totalValue = materialBalance.reduce((sum, r) => sum + r.totalValue, 0);
    }
    return NextResponse.json({
        success: true,
        summary: {
            totalStockValue: isGlobalManager ? Math.round(totalValue) : null,
            totalStockQuantity: totalQuantity,
            totalUniqueItems: itemStockMap.size,
            lowStockCount: lowStockAlerts.length,
            pendingDispatchCount: pendingDispatches.length,
            pendingGrnCount: pendingGrns.length,
            pendingMrnCount: pendingMrnsCount,
        },
        lowStockAlerts: lowStockAlerts.slice(0, 10),
        pendingDispatches,
        pendingGrns,
        materialBalance: materialBalance.slice(0, 50),
        expiringBatches: expiringBatches.slice(0, 20),
    });
}, {
    roles: [...ROLE_GROUPS.STORES, 'OSP_MANAGER', 'AREA_MANAGER'],
    rawResponse: true
});