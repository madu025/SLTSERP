import { apiHandler } from '@/lib/api-handler';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

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

    let totalValue = 0;
    let totalQuantity = 0;
    const itemStockMap = new Map<string, { item: { id: string; name: string; unitPrice: number | null; minLevel: number; category: string | null; }; totalQty: number }>();

    for (const s of stocks) {
        const qty = s.quantity || 0;
        const price = s.item?.unitPrice || 0;
        totalValue += qty * price;
        totalQuantity += qty;

        if (s.item) {
            const existing = itemStockMap.get(s.item.id) || { item: s.item, totalQty: 0 };
            existing.totalQty += qty;
            itemStockMap.set(s.item.id, existing);
        }
    }

    // Low stock items
    const lowStockAlerts: Array<{ id: string; name: string; category: string | null; minLevel: number; currentQty: number }> = [];
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
    });
});
