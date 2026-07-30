import { ROLE_GROUPS } from '@/config/roles';
import { MaterialService } from '@/services/inventory/material.service';
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
    roles: ROLE_GROUPS.PROJECT_MANAGERS,
    rawResponse: true
});

export const POST = apiHandler(async (request, _params, body) => {
    const userId = request.headers.get('x-user-id');
    const action = body.action as string | undefined;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { action: _action, ...data } = body;

    if (action === 'ISSUE') {
        const result = await MaterialService.issueMaterials(
            data as Parameters<typeof MaterialService.issueMaterials>[0],
            userId ?? undefined
        );
        return { success: true, data: result };
    }

    if (action === 'GENERATE_SHEET') {
        const contractorId = data.contractorId as string | undefined;
        const storeId = data.storeId as string | undefined;
        const month = data.month as string | undefined;
        const result = await MaterialService.generateBalanceSheet(
            contractorId ?? '', storeId ?? '', month ?? '', userId ?? undefined
        );
        return { success: true, data: result };
    }

    throw AppError.badRequest('Invalid action');
}, {
    roles: ROLE_GROUPS.STORES_MANAGERS,
    audit: { action: 'EXECUTE', entity: 'RECONCILIATION' },
    rawResponse: true
});
