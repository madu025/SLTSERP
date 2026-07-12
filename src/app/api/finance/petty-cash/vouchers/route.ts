import { apiHandler } from '@/lib/api-handler';
import { PettyCashService } from '@/services/finance/petty-cash.service';

export const dynamic = 'force-dynamic';

// GET /api/finance/petty-cash/vouchers - Get vouchers for an account (by accountId query param) (rawResponse for compatibility)
export const GET = apiHandler(async (req) => {
    const { searchParams } = new URL(req.url);
    const accountId = searchParams.get('accountId');

    if (!accountId) {
        throw new Error('accountId is required');
    }

    const account = await PettyCashService.getPettyCashAccount(accountId);
    if (!account) {
        throw new Error('Account not found');
    }

    return account.vouchers;
}, {
    rawResponse: true
});

// POST /api/finance/petty-cash/vouchers - Create a new voucher
export const POST = apiHandler(async (req, _params, body) => {
    const { accountId, title, amount, category, description, recipientName, receiptUrl } = body;
    const userId = req.headers.get("x-user-id");

    if (!accountId || !title || amount === undefined || !category || !userId) {
        throw new Error('accountId, title, amount, and category are required and user must be authenticated');
    }

    return await PettyCashService.createVoucher({
        accountId,
        title,
        amount: parseFloat(amount),
        category,
        description,
        recipientName,
        receiptUrl,
        createdById: userId
    });
}, {
    audit: { action: 'CREATE', entity: 'PETTY_CASH_VOUCHER' },
    rawResponse: true
});

// PATCH /api/finance/petty-cash/vouchers - Approve or reject a voucher
export const PATCH = apiHandler(async (req, _params, body) => {
    const { id, action, rejectionReason } = body;
    const userId = req.headers.get("x-user-id");

    if (!id || !action || !userId) {
        throw new Error('id and action are required and user must be authenticated');
    }

    if (action === 'APPROVE') {
        return await PettyCashService.approveVoucher(id, userId);
    } else if (action === 'REJECT') {
        return await PettyCashService.rejectVoucher(id, rejectionReason || 'Rejected', userId);
    } else {
        throw new Error('Invalid action. Must be APPROVE or REJECT');
    }
}, {
    roles: ['FINANCE_MANAGER', 'SUPER_ADMIN'],
    audit: { action: 'UPDATE_STATUS', entity: 'PETTY_CASH_VOUCHER' },
    rawResponse: true
});
