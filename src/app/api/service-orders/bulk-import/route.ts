export const dynamic = 'force-dynamic';
import { ROLE_GROUPS } from '@/config/roles';
import { apiHandler } from '@/lib/api-handler';
import { ServiceOrderService } from '@/services/service-order/sod.service';
import { bulkImportSchema } from '@/lib/validations/service-order.schema';

export const POST = apiHandler(async (_req, _params, body) => {
    const { rows, rtom, opmcId } = body;

    const result = await ServiceOrderService.bulkImportServiceOrders(rtom, rows, opmcId);
    
    return {
        message: `Import completed: ${result.created} succeeded, ${result.failed} failed`,
        ...result
    };
}, { 
    schema: bulkImportSchema,
    roles: ROLE_GROUPS.PROJECT_MANAGERS,
    audit: { action: 'BULK_IMPORT', entity: 'ServiceOrder' }
});
