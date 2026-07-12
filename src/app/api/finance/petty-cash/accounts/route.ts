import { apiHandler } from '@/lib/api-handler';
import { PettyCashService } from '@/services/finance/petty-cash.service';

export const dynamic = 'force-dynamic';

// GET /api/finance/petty-cash/accounts - List petty cash accounts (rawResponse for compatibility)
export const GET = apiHandler(async () => {
    return await PettyCashService.getPettyCashAccounts();
}, {
    rawResponse: true
});

// POST /api/finance/petty-cash/accounts - Initialize new petty cash account
export const POST = apiHandler(async (req, _params, body) => {
    const { name, opmcId, imprestLimit } = body;
    const userId = req.headers.get("x-user-id");

    if (!name || !opmcId || !imprestLimit || !userId) {
        throw new Error('name, opmcId, imprestLimit are required and user must be authenticated');
    }

    return await PettyCashService.createPettyCashAccount({
        name,
        opmcId,
        imprestLimit: parseFloat(imprestLimit),
        createdById: userId
    });
}, {
    roles: ['FINANCE_MANAGER', 'SUPER_ADMIN'],
    audit: { action: 'CREATE', entity: 'PETTY_CASH_ACCOUNT' },
    rawResponse: true
});
