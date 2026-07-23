import { apiHandler } from '@/lib/api-handler';
import { InventoryService } from '@/services/inventory';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const createLocatorSchema = z.object({
    storeId: z.string().min(1, "Store ID is required"),
    code: z.string().min(1, "Locator code is required"),
    aisle: z.string().optional(),
    rack: z.string().optional(),
    shelf: z.string().optional(),
    bin: z.string().optional(),
    description: z.string().optional()
});

export const GET = apiHandler(async (request: Request) => {
    const { searchParams } = new URL(request.url);
    const storeId = searchParams.get('storeId');
    if (!storeId) return [];
    return await InventoryService.getLocatorsByStore(storeId);
}, { rawResponse: true });

export const POST = apiHandler(async (_request: Request, _params: any, body: any) => {
    const data = createLocatorSchema.parse(body);
    return await InventoryService.createLocator(data);
}, {
    audit: { action: 'CREATE', entity: 'WarehouseLocator' },
    rawResponse: true
});
