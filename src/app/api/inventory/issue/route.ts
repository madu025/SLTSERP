import { apiHandler } from '@/lib/api-handler';
import { InventoryService } from '@/services/inventory.service';
import { materialIssueSchema } from '@/lib/validations/inventory.schema';

// POST: Issue materials to a contractor
export const POST = apiHandler(async (req, _params, body) => {
    const userEmail = req.headers.get('x-user-id');

    const issue = await InventoryService.issueMaterial({
        ...body,
        items: body.items.map((i: any) => ({ ...i, quantity: i.quantity.toString() })),
        userId: userEmail || undefined
    });

    return { 
        message: 'Materials issued successfully and inventory updated', 
        issueId: issue.id 
    };
}, {
    schema: materialIssueSchema,
    roles: ['STORES_MANAGER', 'STORES_ASSISTANT', 'SUPER_ADMIN', 'ADMIN']
});

// GET: Fetch Data
export const GET = apiHandler(async (req) => {
    const { searchParams } = new URL(req.url);
    const contractorId = searchParams.get('contractorId');
    const month = searchParams.get('month');

    if (!contractorId) {
        throw new Error('Contractor ID required');
    }

    return await InventoryService.getMaterialIssues(contractorId, month || undefined);
});

export const dynamic = 'force-dynamic';
