import { InventoryService } from '@/services/inventory';
import { ROLE_GROUPS } from '@/config/roles';
import { apiHandler, castBody } from '@/lib/api-handler';

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
export const POST = apiHandler(async (request, _params, body) => {
    const userId = request.headers.get('x-user-id') || '';

    const input = castBody<CreateStockIssueInput>(body);
    const result = await InventoryService.createStockIssue({
        ...input,
        issuedById: userId
    });

    return result;
}, {
    roles: ROLE_GROUPS.STORES_ALL,
    audit: { action: 'CREATE', entity: 'STOCK_ISSUE' },
    rawResponse: true
});

// GET: Fetch stock issues
export const GET = apiHandler(async (request) => {
    const { searchParams } = new URL(request.url);
    const storeId = searchParams.get('storeId') || undefined;
    const issueType = searchParams.get('issueType') || undefined;

    const issues = await InventoryService.getStockIssues({ storeId, issueType });
    return issues;
}, {
    roles: ROLE_GROUPS.STORES_ALL,
    rawResponse: true
});
