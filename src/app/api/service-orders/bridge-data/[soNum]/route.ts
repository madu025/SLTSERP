import { apiHandler } from '@/lib/api-handler';
import { ServiceOrderService } from '@/services/sod.service';
import { AppError } from '@/lib/error';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async (_request, params) => {
    const { soNum } = await params;

    if (!soNum) {
        throw AppError.badRequest('SO Number is required');
    }

    const rawData = await ServiceOrderService.getExtensionRawData(soNum);

    return {
        success: true,
        data: rawData
    };
}, { rawResponse: true });
