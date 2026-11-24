import { getAuthenticatedUserId } from '@/lib/request-context';
import { apiHandler } from '@/lib/api-handler';
import { AppError } from '@/lib/error';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { PettyCashService } from '@/services/finance/petty-cash.service';

export const dynamic = 'force-dynamic';

// GET /api/finance/petty-cash/accounts - List petty cash accounts (rawResponse for compatibility)
export const GET = apiHandler(async (req) => {
    // ?summary=1: every box with its cash in hand, cash on open IOUs and the bills waiting to be reimbursed
    if (new URL(req.url).searchParams.get('summary')) return await PettyCashService.getSummaries(getAuthenticatedUserId());
    return await PettyCashService.getPettyCashAccounts(getAuthenticatedUserId());
}, {
    permissions: [RBAC_PERMISSIONS.FINANCE_READ, RBAC_PERMISSIONS.PETTY_CASH_SITE],
    rawResponse: true
});

// POST /api/finance/petty-cash/accounts - Initialize new petty cash account
export const POST = apiHandler(async (req, _params, body) => {
    const name = body.name as string | undefined;
    const siteOfficeId = body.siteOfficeId as string | undefined;
    const imprestLimit = body.imprestLimit as string | number | undefined;
    const openingBalance = body.openingBalance as string | number | undefined;
    const userId = getAuthenticatedUserId();

    if (!name || !siteOfficeId || imprestLimit === undefined || !userId) {
        throw AppError.badRequest('name, siteOfficeId, and imprestLimit are required');
    }

    return await PettyCashService.createPettyCashAccount({
        name,
        siteOfficeId,
        imprestLimit: parseFloat(String(imprestLimit)),
        openingBalance: openingBalance === undefined || openingBalance === '' ? 0 : parseFloat(String(openingBalance)),
        createdById: userId
    });
}, {
    permissions: [RBAC_PERMISSIONS.FINANCE_APPROVE], // setting an imprest is the finance approver's decision
    audit: { action: 'CREATE', entity: 'PETTY_CASH_ACCOUNT' },
    rawResponse: true
});
