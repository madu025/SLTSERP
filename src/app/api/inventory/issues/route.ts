import { InventoryService } from '@/services/inventory';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { apiHandler, castBody } from '@/lib/api-handler';
import { StoreService } from '@/services/inventory/store.service';
import { AppError } from '@/lib/error';
import { assertProjectAccess } from '@/lib/project-access';

export const dynamic = 'force-dynamic';

interface CreateStockIssueInput {
    storeId: string;
    issueType: string;
    projectId?: string;
    contractorId?: string;
    teamId?: string;
    recipientName: string;
    remarks?: string;
    items: { itemId: string; quantity: string | number; remarks?: string; serials?: string[] }[];
    issuedById: string;
}

// POST: Create a stock issue (store-level material issuance)
export const POST = apiHandler(async (_request, params, body) => {
    const userId = params._userId;
    if (!userId) throw AppError.unauthorized('Authentication required');

    const input = castBody<CreateStockIssueInput>(body);
    if (input.projectId) await assertProjectAccess(input.projectId, userId);
    const result = await InventoryService.createStockIssue({
        ...input,
        issuedById: userId
    });

    return result;
}, {
    permissions: [RBAC_PERMISSIONS.INVENTORY_WRITE],
    audit: { action: 'CREATE', entity: 'STOCK_ISSUE' },
    rawResponse: true
});

// GET: Fetch stock issues
export const GET = apiHandler(async (request, params) => {
    const { searchParams } = new URL(request.url);
    const storeId = searchParams.get('storeId') || undefined;
    const issueType = searchParams.get('issueType') || undefined;

    if (!params._userId) throw AppError.unauthorized('Authentication required');
    const stores = await StoreService.getAccessibleStores(params._userId, '');
    const allowedStoreIds = stores.map((store) => store.id);
    if (storeId && !allowedStoreIds.includes(storeId)) throw AppError.forbidden('STORE_SCOPE_VIOLATION');
    const issues = await InventoryService.getStockIssues({ storeId, issueType, allowedStoreIds });
    return issues;
}, {
    permissions: [RBAC_PERMISSIONS.INVENTORY_READ],
    rawResponse: true
});
