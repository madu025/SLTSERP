export const dynamic = 'force-dynamic';
import { ROLE_GROUPS } from '@/config/roles';
import { apiHandler } from '@/lib/api-handler';
import { ServiceOrderService } from '@/services/service-order/sod.service';
import { bulkImportSchema } from '@/lib/validations/service-order.schema';
import { AppError } from '@/lib/error';
import { resolveOpmcScope } from '@/lib/opmc-scope';

export const POST = apiHandler(async (_req, params, body) => {
    const { rows, rtom, opmcId } = body;

    // Regional ownership check: non-admin users may only bulk-import into
    // their accessible OPMCs (admins unrestricted).
    const scope = await resolveOpmcScope(params._userId);
    if (scope !== undefined && !scope.includes(opmcId)) {
        throw AppError.forbidden('Target OPMC is outside your regional access');
    }

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
