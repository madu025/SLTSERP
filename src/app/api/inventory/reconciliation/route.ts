import { MaterialService } from '@/services/material.service';
import { apiHandler } from '@/lib/api-handler';
import { AppError } from '@/lib/error';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async (request) => {
    const { searchParams } = new URL(request.url);
    const contractorId = searchParams.get('contractorId');
    const storeId = searchParams.get('storeId');
    const month = searchParams.get('month');

    if (!contractorId || !storeId || !month) {
        throw AppError.badRequest('Missing parameters');
    }

    const data = await MaterialService.getReconciliation({ contractorId, storeId, month });
    return { success: true, data };
}, {
    roles: ['SUPER_ADMIN', 'ADMIN', 'STORES_MANAGER', 'OSP_MANAGER'],
    rawResponse: true
});

export const POST = apiHandler(async (request, _params, body) => {
    const userId = request.headers.get('x-user-id');
    const { action, ...data } = body;

    if (action === 'ISSUE') {
        const result = await MaterialService.issueMaterials(data, userId || undefined);
        return { success: true, data: result };
    }

    if (action === 'GENERATE_SHEET') {
        const { contractorId, storeId, month } = data;
        const result = await MaterialService.generateBalanceSheet(contractorId, storeId, month, userId || undefined);
        return { success: true, data: result };
    }

    throw AppError.badRequest('Invalid action');
}, {
    roles: ['SUPER_ADMIN', 'ADMIN', 'STORES_MANAGER'],
    audit: { action: 'EXECUTE', entity: 'RECONCILIATION' },
    rawResponse: true
});
