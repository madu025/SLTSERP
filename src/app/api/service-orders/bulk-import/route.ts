import { apiHandler } from '@/lib/api-handler';
import { ServiceOrderService } from '@/services/sod.service';
import { bulkImportSchema } from '@/lib/validations/service-order.schema';

export const POST = apiHandler(async (_req, _params, body) => {
    const { rows, rtom, opmcId } = body;

    const result = await ServiceOrderService.bulkImportServiceOrders(rtom, rows, opmcId);
    
    return {
        message: `Import completed: ${result.created} succeeded, ${result.failed} failed`,
        ...result
    };
}, { schema: bulkImportSchema });
