import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiHandler } from '@/lib/api-handler';
import { z } from 'zod';
import { AppError } from '@/lib/error';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { StoreService } from '@/services/inventory/store.service';

export const dynamic = 'force-dynamic';

const querySchema = z.object({
    storeId: z.string().min(1, 'Store ID is required')
});

export const GET = apiHandler(async (req, params) => {
    const { searchParams } = new URL(req.url);
    const storeId = searchParams.get('storeId');

    const result = querySchema.safeParse({ storeId });
    if (!result.success) {
        return NextResponse.json({ success: false, error: 'Store ID is required' }, { status: 400 });
    }
    if (!params._userId) throw AppError.unauthorized('Authentication required');

    const accessibleStores = await StoreService.getAccessibleStores(params._userId);
    if (!accessibleStores.some((store) => store.id === storeId)) {
        throw AppError.forbidden('STORE_SCOPE_VIOLATION');
    }

    // Find all requests for this store that are in PARTIALLY_ISSUED or other open states (excluding COMPLETED/REJECTED)
    const openRequests = await prisma.stockRequest.findMany({
        where: {
            fromStoreId: storeId,
            status: { notIn: ['COMPLETED', 'REJECTED'] },
        },
        include: {
            items: {
                include: { item: true }
            }
        },
        orderBy: { createdAt: 'asc' }
    });

    const pendingBalances = openRequests.flatMap(req => {
        return req.items
            .filter(i => {
                const targetQty = Number(i.approvedQty.toNumber() > 0 ? i.approvedQty : i.requestedQty);
                const issued = Number(i.issuedQty || 0);
                return issued < targetQty;
            })
            .map(i => {
                const targetQty = Number(i.approvedQty.toNumber() > 0 ? i.approvedQty : i.requestedQty);
                const issued = Number(i.issuedQty || 0);
                return {
                    requestId: req.id,
                    requestNr: req.requestNr,
                    itemId: i.itemId,
                    itemName: i.item.name,
                    itemCode: i.item.code,
                    targetQty,
                    issuedQty: issued,
                    balanceQty: targetQty - issued,
                    status: req.status,
                    workflowStage: req.workflowStage,
                    createdAt: req.createdAt
                };
            });
    });

    return NextResponse.json({
        success: true,
        data: pendingBalances
    });
}, {
    permissions: [RBAC_PERMISSIONS.INVENTORY_READ],
    rawResponse: true,
});
