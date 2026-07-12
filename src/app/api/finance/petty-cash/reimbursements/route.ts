import { apiHandler } from '@/lib/api-handler';
import { PettyCashService } from '@/services/finance/petty-cash.service';

export const dynamic = 'force-dynamic';

// GET /api/finance/petty-cash/reimbursements - List all reimbursements or filter by accountId (rawResponse for compatibility)
export const GET = apiHandler(async (req) => {
    const { searchParams } = new URL(req.url);
    const accountId = searchParams.get('accountId') || undefined;

    return await PettyCashService.getReimbursements(accountId);
}, {
    rawResponse: true
});

// POST /api/finance/petty-cash/reimbursements - Submit reimbursement request
export const POST = apiHandler(async (req, _params, body) => {
    const { accountId } = body;
    const userId = req.headers.get("x-user-id");

    if (!accountId || !userId) {
        throw new Error('accountId is required and user must be authenticated');
    }

    return await PettyCashService.requestReimbursement(accountId, userId);
}, {
    audit: { action: 'REQUEST_REIMBURSEMENT', entity: 'PETTY_CASH_REIMBURSEMENT' },
    rawResponse: true
});

// PATCH /api/finance/petty-cash/reimbursements - Complete reimbursement (reimbursed)
export const PATCH = apiHandler(async (req, _params, body) => {
    const { id, paymentVoucherId } = body;
    const userId = req.headers.get("x-user-id");

    if (!id || !paymentVoucherId || !userId) {
        throw new Error('id and paymentVoucherId are required and user must be authenticated');
    }

    return await PettyCashService.completeReimbursement(id, paymentVoucherId, userId);
}, {
    roles: ['FINANCE_MANAGER', 'SUPER_ADMIN'],
    audit: { action: 'COMPLETE_REIMBURSEMENT', entity: 'PETTY_CASH_REIMBURSEMENT' },
    rawResponse: true
});
