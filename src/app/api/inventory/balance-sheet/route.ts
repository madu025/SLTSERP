import { InventoryService } from '@/services/inventory.service';
import { apiHandler } from '@/lib/api-handler';
import { AppError } from '@/lib/error';

export const POST = apiHandler(async (request, _params, body) => {
    const userId = request.headers.get('x-user-id');
    
    try {
        const result = await InventoryService.saveBalanceSheet({
            ...body,
            userId
        });
        return { message: 'Balance sheet saved successfully', id: result.id };
    } catch (error: any) {
        if (error.message === 'MISSING_FIELDS') {
            throw AppError.badRequest('Missing fields');
        }
        console.error('Error saving balance sheet:', error);
        throw AppError.internal('Internal Server Error');
    }
}, {
    audit: { action: 'CREATE', entity: 'BALANCE_SHEET' },
    rawResponse: true
});
