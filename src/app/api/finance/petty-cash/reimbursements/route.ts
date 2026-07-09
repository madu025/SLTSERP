import { NextRequest, NextResponse } from 'next/server';
import { PettyCashService } from '@/services/finance/petty-cash.service';
import { requireAuth } from '@/lib/server-utils';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// GET /api/finance/petty-cash/reimbursements - List all reimbursements or filter by accountId
export async function GET(request: NextRequest) {
    try {
        await requireAuth();
        const { searchParams } = new URL(request.url);
        const accountId = searchParams.get('accountId');

        if (accountId) {
            const account = await PettyCashService.getPettyCashAccount(accountId);
            if (!account) return NextResponse.json({ error: 'Account not found' }, { status: 404 });
            const reimbursements = await prisma.pettyCashReimbursement.findMany({
                where: { accountId },
                orderBy: { createdAt: 'desc' }
            });
            return NextResponse.json(reimbursements);
        }

        // Return all reimbursements
        const allReimbursements = await prisma.pettyCashReimbursement.findMany({
            include: {
                account: {
                    select: { name: true }
                }
            },
            orderBy: { createdAt: 'desc' }
        });
        return NextResponse.json(allReimbursements);
    } catch (error: unknown) {
        console.error('Error fetching petty cash reimbursements:', error);
        return NextResponse.json({ error: 'Failed to fetch petty cash reimbursements' }, { status: 500 });
    }
}

// POST /api/finance/petty-cash/reimbursements - Submit reimbursement request
export async function POST(request: NextRequest) {
    try {
        await requireAuth();
        const body = await request.json();
        const { accountId, createdById } = body;

        if (!accountId || !createdById) {
            return NextResponse.json(
                { error: 'accountId and createdById are required' },
                { status: 400 }
            );
        }

        const reimbursement = await PettyCashService.requestReimbursement(accountId, createdById);
        return NextResponse.json(reimbursement, { status: 201 });
    } catch (error: unknown) {
        console.error('Error requesting petty cash reimbursement:', error);
        const msg = error instanceof Error ? error.message : 'Failed to request reimbursement';
        if (msg === 'NO_APPROVED_VOUCHERS_FOR_REIMBURSEMENT') {
            return NextResponse.json({ error: 'No approved vouchers found for reimbursement' }, { status: 400 });
        }
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}

// PATCH /api/finance/petty-cash/reimbursements - Complete reimbursement (reimbursed)
export async function PATCH(request: NextRequest) {
    try {
        await requireAuth();
        const body = await request.json();
        const { id, paymentVoucherId, userId } = body;

        if (!id || !paymentVoucherId || !userId) {
            return NextResponse.json(
                { error: 'id, paymentVoucherId, and userId are required' },
                { status: 400 }
            );
        }

        const reimbursement = await PettyCashService.completeReimbursement(id, paymentVoucherId, userId);
        return NextResponse.json(reimbursement);
    } catch (error: unknown) {
        console.error('Error completing petty cash reimbursement:', error);
        return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to complete reimbursement' }, { status: 500 });
    }
}
