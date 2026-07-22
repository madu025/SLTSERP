import { z } from 'zod';
import { apiHandler } from '@/lib/api-handler';
import { ServiceOrderService } from '@/services/sod.service';
import { AppError } from '@/lib/error';

const syncSODSchema = z.object({
    rtomId: z.string().optional(),
    opmcId: z.string().optional(),
    rtom: z.string().optional(),
}).refine((data) => Boolean(data.rtomId || data.opmcId || data.rtom), {
    message: 'RTOM selection or OPMC ID is required for sync'
});

export const POST = apiHandler<unknown, z.infer<typeof syncSODSchema>>(async (_request, _params, body) => {
    const targetId = body.rtomId || body.opmcId;
    const rtom = body.rtom || '';

    if (!targetId) {
        throw AppError.badRequest('RTOM selection or OPMC ID is required for sync');
    }

    try {
        const result = await ServiceOrderService.syncServiceOrders(targetId, rtom);
        return result;
    } catch (error: unknown) {
        const errMessage = error instanceof Error ? error.message : (error as { message?: string })?.message;
        if (errMessage === 'RTOM_AND_ID_REQUIRED') {
            throw AppError.badRequest('RTOM selection is required');
        }
        throw error;
    }
}, {
    schema: syncSODSchema,
    audit: { action: 'SYNC_SERVICE_ORDERS', entity: 'ServiceOrder' },
    rawResponse: true
});


