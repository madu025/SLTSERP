export const dynamic = 'force-dynamic';
import { InventoryService } from '@/services/inventory/inventory.service';
import { apiHandler } from '@/lib/api-handler';
import { AppError } from '@/lib/error';

export const POST = apiHandler(async (request, _params, body) => {
    const userId = request.headers.get('x-user-id');

    try {
        const result = await InventoryService.saveBalanceSheet({
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ...(body as any),
            userId: userId || 'SYSTEM'
        });
        return { message: 'Balance sheet saved successfully', id: result.id };
    } catch (error: unknown) {
        const err = error as { message?: string };
        if (err?.message === 'MISSING_FIELDS') throw AppError.badRequest('Missing fields');
        throw error;
    }
}, {
    audit: { action: 'CREATE', entity: 'BALANCE_SHEET' },
    rawResponse: true
});
