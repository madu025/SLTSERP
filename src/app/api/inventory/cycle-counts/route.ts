import { apiHandler } from '@/lib/api-handler';
import { InventoryService } from '@/services/inventory';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const createCycleCountSchema = z.object({
    storeId: z.string().min(1, "Store ID is required"),
    countType: z.enum(['BLIND', 'REGULAR']).optional(),
    remarks: z.string().optional(),
    itemIds: z.array(z.string()).optional()
});

export const GET = apiHandler(async (request: Request) => {
    const { searchParams } = new URL(request.url);
    const storeId = searchParams.get('storeId') || undefined;
    const status = searchParams.get('status') || undefined;
    return await InventoryService.getCycleCounts(storeId, status);
}, { rawResponse: true });

export const POST = apiHandler(async (request: Request, _params: any, body: any) => {
    const data = createCycleCountSchema.parse(body);
    const userId = request.headers.get('x-user-id') || 'system';

    return await InventoryService.createCycleCount({
        ...data,
        countedById: userId
    });
}, {
    audit: { action: 'CREATE', entity: 'CycleCount' },
    rawResponse: true
});
