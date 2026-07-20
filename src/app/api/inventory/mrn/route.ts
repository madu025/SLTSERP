import { InventoryService } from '@/services/inventory.service';
import { apiHandler } from '@/lib/api-handler';
import { AppError } from '@/lib/error';

export const dynamic = 'force-dynamic';

export const POST = apiHandler(async (request, _params, body) => {
    try {
        const result = await InventoryService.createMRN(body);
        return result;
    } catch (error) {
        console.error("MRN Creation Error:", error);
        throw AppError.internal('Failed to create MRN');
    }
}, {
    audit: { action: 'CREATE', entity: 'MRN' },
    rawResponse: true
});

export const GET = apiHandler(async (request) => {
    try {
        const { searchParams } = new URL(request.url);
        const storeId = searchParams.get('storeId') || undefined;
        const status = searchParams.get('status') || undefined;

        const mrns = await InventoryService.getMRNs(storeId, status);
        return mrns;
    } catch (error) {
        console.error("MRN Fetch Error:", error);
        throw AppError.internal('Failed to fetch MRNs');
    }
}, { rawResponse: true });

export const PATCH = apiHandler(async (request, _params, body) => {
    try {
        const { mrnId, action, approvedById } = body;
        const result = await InventoryService.updateMRNStatus(mrnId, action, approvedById);
        return result;
    } catch (error: unknown) {
        const err = error as { message?: string };
        if (err?.message === 'MRN_NOT_FOUND') {
            throw AppError.notFound('MRN not found');
        }
        if (err?.message === 'INVALID_ACTION') {
            throw AppError.badRequest('Invalid action');
        }
        console.error("MRN Approval Error:", error);
        throw AppError.internal('Failed to process MRN');
    }
}, {
    audit: { action: 'UPDATE', entity: 'MRN' },
    rawResponse: true
});
