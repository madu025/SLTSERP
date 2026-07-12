import { apiHandler } from '@/lib/api-handler';
import { ProjectGoodsReceiptService } from '@/services/project-goods-receipt.service';

export const dynamic = 'force-dynamic';

// GET /api/projects/goods-receipts?projectId=xxx - List GRs by project
export const GET = apiHandler(async (req) => {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('projectId') || undefined;
    const poId = searchParams.get('poId') || undefined;

    if (!projectId && !poId) {
        throw new Error('projectId or poId is required');
    }

    return await ProjectGoodsReceiptService.getGoodsReceipts(projectId, poId);
}, {
    rawResponse: true
});

// POST /api/projects/goods-receipts - Create a new goods receipt
export const POST = apiHandler(async (req, _params, body) => {
    const { poId, projectId, items } = body;
    const userId = req.headers.get('x-user-id');

    if (!poId || !projectId || !userId || !items?.length) {
        throw new Error('poId, projectId, and items are required and user must be authenticated');
    }

    const payload = {
        ...body,
        receivedById: userId
    };

    return await ProjectGoodsReceiptService.createGoodsReceipt(payload);
}, {
    roles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'STORES_MANAGER'],
    audit: { action: 'CREATE', entity: 'PROJECT_GOODS_RECEIPT' },
    rawResponse: true
});

// PATCH /api/projects/goods-receipts - Approve/reject goods receipt
export const PATCH = apiHandler(async (req, _params, body) => {
    const { id, status } = body;
    const userId = req.headers.get('x-user-id') || undefined;

    if (!id || !status) {
        throw new Error('id and status are required');
    }

    return await ProjectGoodsReceiptService.updateGoodsReceiptStatus(id, status, userId);
}, {
    roles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'STORES_MANAGER'],
    audit: { action: 'UPDATE_STATUS', entity: 'PROJECT_GOODS_RECEIPT' },
    rawResponse: true
});
