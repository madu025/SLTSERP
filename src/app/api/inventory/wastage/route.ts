import { apiHandler } from '@/lib/api-handler';
import { recordWastage } from '@/actions/inventory-actions';
import { AppError } from '@/lib/error';

export const POST = apiHandler(async (request, _params, body) => {
    const result = await recordWastage(body);

    if (result.success) {
        return { success: true, data: result.data };
    } else {
        throw AppError.badRequest(result.error);
    }
}, {
    rawResponse: true
});
