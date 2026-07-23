import { apiHandler } from '@/lib/api-handler';
import { InventoryService } from '@/services/inventory';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const submitCountSchema = z.object({
    lines: z.array(z.object({
        lineId: z.string(),
        countedQty: z.number().min(0),
        notes: z.string().optional()
    }))
});

export const GET = apiHandler(async (_request: Request, params: any) => {
    const { id } = params;
    return await InventoryService.getCycleCountById(id);
}, { rawResponse: true });

export const PUT = apiHandler(async (_request: Request, params: any, body: any) => {
    const { id } = params;
    const { lines } = submitCountSchema.parse(body);

    return await InventoryService.submitCountResults(id, lines);
}, {
    audit: { action: 'SUBMIT_RESULTS', entity: 'CycleCount' },
    rawResponse: true
});
