import { NextRequest, NextResponse } from 'next/server';
import { PettyCashService } from '@/services/finance/petty-cash.service';
import { requireAuth } from '@/lib/server-utils';

export const dynamic = 'force-dynamic';

// GET /api/finance/petty-cash/vouchers - Get vouchers for an account (by accountId query param)
export async function GET(request: NextRequest) {
    try {
        await requireAuth();
        const { searchParams } = new URL(request.url);
        const accountId = searchParams.get('accountId');

        if (!accountId) {
            return NextResponse.json({ error: 'accountId is required' }, { status: 400 });
        }

        const account = await PettyCashService.getPettyCashAccount(accountId);
        if (!account) {
            return NextResponse.json({ error: 'Account not found' }, { status: 404 });
        }

        return NextResponse.json(account.vouchers);
    } catch (error: unknown) {
        console.error('Error fetching petty cash vouchers:', error);
        return NextResponse.json({ error: 'Failed to fetch petty cash vouchers' }, { status: 500 });
    }
}

// POST /api/finance/petty-cash/vouchers - Create a new voucher
export async function POST(request: NextRequest) {
    try {
        await requireAuth();
        const body = await request.json();
        const { accountId, title, amount, category, description, recipientName, receiptUrl, createdById } = body;

        if (!accountId || !title || amount === undefined || !category || !createdById) {
            return NextResponse.json(
                { error: 'accountId, title, amount, category, and createdById are required' },
                { status: 400 }
            );
        }

        const voucher = await PettyCashService.createVoucher({
            accountId,
            title,
            amount: parseFloat(amount),
            category,
            description,
            recipientName,
            receiptUrl,
            createdById
        });

        return NextResponse.json(voucher, { status: 201 });
    } catch (error: unknown) {
        console.error('Error creating petty cash voucher:', error);
        return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to create voucher' }, { status: 500 });
    }
}

// PATCH /api/finance/petty-cash/vouchers - Approve or reject a voucher
export async function PATCH(request: NextRequest) {
    try {
        await requireAuth();
        const body = await request.json();
        const { id, action, userId, rejectionReason } = body;

        if (!id || !action || !userId) {
            return NextResponse.json(
                { error: 'id, action, and userId are required' },
                { status: 400 }
            );
        }

        if (action === 'APPROVE') {
            const voucher = await PettyCashService.approveVoucher(id, userId);
            return NextResponse.json(voucher);
        } else if (action === 'REJECT') {
            const voucher = await PettyCashService.rejectVoucher(id, rejectionReason || 'Rejected', userId);
            return NextResponse.json(voucher);
        } else {
            return NextResponse.json({ error: 'Invalid action. Must be APPROVE or REJECT' }, { status: 400 });
        }
    } catch (error: unknown) {
        console.error('Error actioning petty cash voucher:', error);
        const msg = error instanceof Error ? error.message : 'Failed to process action';
        if (msg === 'INSUFFICIENT_PETTY_CASH_BALANCE') {
            return NextResponse.json({ error: 'Insufficient Petty Cash Balance in account' }, { status: 400 });
        }
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
