import { InventoryService } from '@/services/inventory/inventory.service';
import { apiHandler, castBody } from '@/lib/api-handler';
import { AppError } from '@/lib/error';
import { ROLE_GROUPS } from '@/config/roles';

export const dynamic = 'force-dynamic';

export const POST = apiHandler(async (_request, _params, body) => {
    try {
        const result = await InventoryService.createMRN(
            castBody<Parameters<typeof InventoryService.createMRN>[0]>(body)
        );
        return result;
    } catch (error) {
        console.error("MRN Creation Error:", error);
        throw AppError.internal('Failed to create MRN');
    }
}, {
    roles: ROLE_GROUPS.STORES_ALL,
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
}, {
    roles: ROLE_GROUPS.STORES_ALL,
    rawResponse: true
});

export const PATCH = apiHandler(async (_request, _params, body) => {
    try {
        const mrnId = body.mrnId as string | undefined;
        const action = body.action as string | undefined;
        const approvedById = body.approvedById as string | undefined;
        if (!mrnId || !action || !approvedById) {
            throw AppError.badRequest('mrnId, action, and approvedById are required');
        }
        const result = await InventoryService.updateMRNStatus(mrnId, action as 'APPROVE' | 'REJECT', approvedById);
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
    roles: ROLE_GROUPS.STORES_ALL,
    audit: { action: 'UPDATE', entity: 'MRN' },
    rawResponse: true
});
