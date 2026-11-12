import { getAuthenticatedUserId } from '@/lib/request-context';
import { apiHandler } from '@/lib/api-handler';
import { AppError } from '@/lib/error';
import { PettyCashService } from '@/services/finance/petty-cash.service';

export const dynamic = 'force-dynamic';

// GET /api/finance/petty-cash/accounts - List petty cash accounts (rawResponse for compatibility)
export const GET = apiHandler(async () => {
    return await PettyCashService.getPettyCashAccounts(getAuthenticatedUserId());
}, {
    rawResponse: true
});

// POST /api/finance/petty-cash/accounts - Initialize new petty cash account
export const POST = apiHandler(async (req, _params, body) => {
    const name = body.name as string | undefined;
    const opmcId = body.opmcId as string | undefined;
    const imprestLimit = body.imprestLimit as string | number | undefined;
    const userId = getAuthenticatedUserId();

    if (!name || !opmcId || imprestLimit === undefined || !userId) {
        throw AppError.badRequest('name, opmcId, and imprestLimit are required');
    }

    return await PettyCashService.createPettyCashAccount({
        name,
        opmcId,
        imprestLimit: parseFloat(String(imprestLimit)),
        createdById: userId
    });
}, {
    audit: { action: 'CREATE', entity: 'PETTY_CASH_ACCOUNT' },
    rawResponse: true
});
