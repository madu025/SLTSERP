import { ROLE_GROUPS } from '@/config/roles';
import { apiHandler } from '@/lib/api-handler';
import { AppError } from '@/lib/error';
import { PettyCashService } from '@/services/finance/petty-cash.service';

export const dynamic = 'force-dynamic';

// GET /api/finance/petty-cash/vouchers - Get vouchers for an account (by accountId query param) (rawResponse for compatibility)
export const GET = apiHandler(async (req) => {
    const { searchParams } = new URL(req.url);
    const accountId = searchParams.get('accountId');

    if (!accountId) {
        throw AppError.badRequest('accountId query parameter is required');
    }

    const account = await PettyCashService.getPettyCashAccount(accountId);
    if (!account) {
        throw AppError.notFound('Petty cash account not found');
    }

    return account.vouchers;
}, {
    rawResponse: true
});

// POST /api/finance/petty-cash/vouchers - Create a new voucher
export const POST = apiHandler(async (req, _params, body) => {
    const accountId = body.accountId as string | undefined;
    const title = body.title as string | undefined;
    const amount = body.amount as string | number | undefined;
    const category = body.category as string | undefined;
    const description = body.description as string | null | undefined;
    const recipientName = body.recipientName as string | null | undefined;
    const receiptUrl = body.receiptUrl as string | null | undefined;
    const userId = req.headers.get("x-user-id");

    if (!accountId || !title || amount === undefined || !category || !userId) {
        throw AppError.badRequest('accountId, title, amount, and category are required');
    }

    return await PettyCashService.createVoucher({
        accountId,
        title,
        amount: parseFloat(String(amount)),
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
    const id = body.id as string | undefined;
    const action = body.action as string | undefined;
    const rejectionReason = body.rejectionReason as string | undefined;
    const userId = req.headers.get("x-user-id");

    if (!id || !action || !userId) {
        throw AppError.badRequest('id and action are required');
    }

    if (action === 'APPROVE') {
        return await PettyCashService.approveVoucher(id, userId);
    } else if (action === 'REJECT') {
        return await PettyCashService.rejectVoucher(id, rejectionReason || 'Rejected', userId);
    } else {
        throw AppError.badRequest('Invalid action. Must be APPROVE or REJECT');
    }
}, {
    roles: ROLE_GROUPS.FINANCE_APPROVERS,
    audit: { action: 'UPDATE_STATUS', entity: 'PETTY_CASH_VOUCHER' },
    rawResponse: true
});
