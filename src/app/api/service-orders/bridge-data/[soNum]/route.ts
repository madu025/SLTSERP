import { apiHandler } from '@/lib/api-handler';
import { ServiceOrderService } from '@/services/service-order/sod.service';
import { AppError } from '@/lib/error';
import { requireExtensionOrSession } from '@/lib/mixed-auth';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async (_request, params) => {
    await requireExtensionOrSession(_request, [RBAC_PERMISSIONS.SOD_READ, RBAC_PERMISSIONS.SOD_WRITE]);
    const { soNum } = await params;

    if (!soNum) {
        throw AppError.badRequest('SO Number is required');
    }

    const rawData = await ServiceOrderService.getExtensionRawData(soNum);

    return {
        success: true,
        data: rawData
    };
}, { rawResponse: true, publicRoute: true });
