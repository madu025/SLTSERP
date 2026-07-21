import { apiHandler } from '@/lib/api-handler';
import { InventoryService } from '@/services/inventory';
import { z } from 'zod';

const createPoSchema = z.object({
    projectId: z.string().min(1, 'Project ID is required'),
    vendorId: z.string().min(1, 'Vendor ID is required'),
    title: z.string().min(1, 'Title is required'),
    items: z.array(z.object({
        itemCode: z.string(),
        description: z.string(),
        unit: z.string(),
        quantity: z.number(),
        unitPrice: z.number()
    })).min(1, 'At least one item is required')
});

export const POST = apiHandler(async (_req, _params, body) => {
    const { projectId, vendorId, title, items } = createPoSchema.parse(body);

    const po = await InventoryService.generateDraftPO({
        projectId,
        vendorId,
        title,
        items
    });

    return Response.json(po);
}, {
    audit: { action: 'GENERATE_DRAFT_PO', entity: 'Inventory' }
});
