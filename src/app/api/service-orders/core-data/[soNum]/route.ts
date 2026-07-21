import { apiHandler } from '@/lib/api-handler';
import { ServiceOrderService } from '@/services/sod.service';
import { AppError } from '@/lib/error';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async (_request, params) => {
    const { soNum } = await params;
    const serviceOrder = await ServiceOrderService.getServiceOrderBySoNum(soNum);

    if (!serviceOrder) {
        throw AppError.notFound('Not found');
    }

    return { success: true, data: serviceOrder };
}, { rawResponse: true });
