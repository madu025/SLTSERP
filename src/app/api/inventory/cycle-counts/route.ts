import { apiHandler } from '@/lib/api-handler';
import { InventoryService } from '@/services/inventory';
import { AppError } from '@/lib/error';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
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
}, { permissions: [RBAC_PERMISSIONS.INVENTORY_READ], rawResponse: true });

export const POST = apiHandler(async (_request: Request, params, body: Record<string, unknown>) => {
    const data = createCycleCountSchema.parse(body);
    const userId = params._userId;
    if (!userId) throw AppError.unauthorized('Authentication required');

    return await InventoryService.createCycleCount({
        ...data,
        countedById: userId
    });
}, {
    permissions: [RBAC_PERMISSIONS.INVENTORY_WRITE],
    audit: { action: 'CREATE', entity: 'CycleCount' },
    rawResponse: true
});
