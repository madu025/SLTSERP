import { apiHandler } from '@/lib/api-handler';
import { ServiceOrderService } from '@/services/sod.service';
import { AppError } from '@/lib/error';

export const POST = apiHandler(async (_request, _params, body) => {
    const { rtomId, opmcId, rtom } = body || {};
    const targetId = rtomId || opmcId;

    try {
        const result = await ServiceOrderService.syncServiceOrders(targetId, rtom);
        return result;
    } catch (error: any) {
        if (error?.message === 'RTOM_AND_ID_REQUIRED') {
            throw AppError.badRequest('RTOM selection is required');
        }
        throw error;
    }
}, {
    audit: { action: 'SYNC_SERVICE_ORDERS', entity: 'ServiceOrder' },
    rawResponse: true
});
