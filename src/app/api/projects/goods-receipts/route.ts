import { apiHandler } from '@/lib/api-handler';
import { AppError } from '@/lib/error';
import { prisma } from '@/lib/prisma';
import { assertProjectAccess } from '@/lib/project-access';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { ProjectGoodsReceiptService } from '@/services/project/project-goods-receipt.service';
import { z } from 'zod';

const goodsReceiptSchema = z.object({
    poId: z.string().min(1), projectId: z.string().min(1),
    receivedDate: z.string().optional(), deliveryNoteRef: z.string().nullable().optional(),
    invoiceRef: z.string().nullable().optional(), remarks: z.string().nullable().optional(),
    storeId: z.string().nullable().optional(),
    items: z.array(z.object({
        poItemId: z.string(), itemCode: z.string(), description: z.string(),
        unit: z.string().optional(), quantityOrdered: z.number(), quantityReceived: z.number(),
        quantityAccepted: z.number().optional(), quantityRejected: z.number().optional(),
        rejectionReason: z.string().nullable().optional(), unitPrice: z.number(),
        batchNumber: z.string().nullable().optional(), serialNumbers: z.array(z.string()).optional(),
        notes: z.string().nullable().optional(),
    })).min(1),
});

export const dynamic = 'force-dynamic';

// GET /api/projects/goods-receipts?projectId=xxx - List GRs by project
export const GET = apiHandler(async (req, params) => {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('projectId') || undefined;
    const poId = searchParams.get('poId') || undefined;

    if (!projectId && !poId) {
        throw AppError.badRequest('projectId or poId is required');
    }

    let scopeProjectId = projectId;
    if (!scopeProjectId && poId) {
        const po = await prisma.projectPurchaseOrder.findUnique({ where: { id: poId }, select: { projectId: true } });
        if (!po) throw AppError.notFound('Purchase order not found');
        scopeProjectId = po.projectId;
    }
    if (scopeProjectId) await assertProjectAccess(scopeProjectId, params._userId);

    return await ProjectGoodsReceiptService.getGoodsReceipts(projectId, poId);
}, {
    permissions: [RBAC_PERMISSIONS.INVENTORY_READ],
    rawResponse: true
});

// POST /api/projects/goods-receipts - Create a new goods receipt
export const POST = apiHandler(async (_req, params, body) => {
    const poId = body.poId as string | undefined;
    const projectId = body.projectId as string | undefined;
    const items = body.items as unknown[] | undefined;
    const userId = params._userId;

    if (!poId || !projectId || !userId || !items?.length) {
        throw AppError.badRequest('poId, projectId, and items are required and user must be authenticated');
    }

    await assertProjectAccess(projectId, params._userId);
    const po = await prisma.projectPurchaseOrder.findUnique({ where: { id: poId }, select: { projectId: true } });
    if (!po) throw AppError.notFound('Purchase order not found');
    if (po.projectId !== projectId) throw AppError.badRequest('Purchase order does not belong to this project');

    const payload = {
        ...goodsReceiptSchema.parse(body),
        receivedById: userId
    };

    return await ProjectGoodsReceiptService.createGoodsReceipt(payload);
}, {
    permissions: [RBAC_PERMISSIONS.INVENTORY_WRITE],
    audit: { action: 'CREATE', entity: 'PROJECT_GOODS_RECEIPT' },
    rawResponse: true
});

// PATCH /api/projects/goods-receipts - Approve/reject goods receipt
export const PATCH = apiHandler(async (_req, params, body) => {
    const id = body.id as string | undefined;
    const status = body.status as string | undefined;
    const userId = params._userId || undefined;

    if (!id || !status) {
        throw AppError.badRequest('id and status are required');
    }

    const grn = await prisma.projectGoodsReceipt.findUnique({ where: { id }, select: { projectId: true } });
    if (!grn) throw AppError.notFound('Goods receipt not found');
    await assertProjectAccess(grn.projectId, params._userId);

    return await ProjectGoodsReceiptService.updateGoodsReceiptStatus(id, status, userId);
}, {
    permissions: [RBAC_PERMISSIONS.INVENTORY_APPROVE],
    audit: { action: 'UPDATE_STATUS', entity: 'PROJECT_GOODS_RECEIPT' },
    rawResponse: true
});
