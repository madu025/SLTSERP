import { apiHandler } from '@/lib/api-handler';
import { AppError } from '@/lib/error';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { InventoryService } from '@/services/inventory';
import { StoreService } from '@/services/inventory/store.service';
import { materialIssueSchema } from '@/lib/validations/inventory.schema';

// POST: Issue materials to a contractor
export const POST = apiHandler(async (_req, params, body) => {
    const userId = params._userId;
    if (!userId) throw AppError.unauthorized('Authentication required');

    const issue = await InventoryService.issueMaterial({
        ...body,
        items: body.items.map((i: { itemId: string; quantity: string | number; unit?: string }) => ({ ...i, quantity: i.quantity.toString() })),
        userId
    });

    return { 
        message: 'Materials issued successfully and inventory updated', 
        issueId: issue.id,
        // Mandatory Store Material Issue Note Number (MIN ref) display
        issueNumber: issue.issueNumber
    };
}, {
    schema: materialIssueSchema,
    permissions: [RBAC_PERMISSIONS.INVENTORY_WRITE]
});

// GET: Fetch Data
export const GET = apiHandler(async (req, params) => {
    const { searchParams } = new URL(req.url);
    const contractorId = searchParams.get('contractorId');
    const month = searchParams.get('month');

    if (!contractorId) {
        throw AppError.badRequest('Contractor ID required');
    }
    if (!params._userId) throw AppError.unauthorized('Authentication required');
    const allowedStoreIds = (await StoreService.getAccessibleStores(params._userId)).map((store) => store.id);

    return await InventoryService.getMaterialIssues(contractorId, month || undefined, allowedStoreIds);
}, {
    permissions: [RBAC_PERMISSIONS.INVENTORY_READ]
});

export const dynamic = 'force-dynamic';
