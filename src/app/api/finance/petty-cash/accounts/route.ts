import { NextRequest, NextResponse } from 'next/server';
import { PettyCashService } from '@/services/finance/petty-cash.service';
import { requireAuth } from '@/lib/server-utils';

export const dynamic = 'force-dynamic';

// GET /api/finance/petty-cash/accounts - List petty cash accounts
export async function GET(request: NextRequest) {
    try {
        await requireAuth();
        const accounts = await PettyCashService.getPettyCashAccounts();
        return NextResponse.json(accounts);
    } catch (error: unknown) {
        console.error('Error fetching petty cash accounts:', error);
        return NextResponse.json({ error: 'Failed to fetch petty cash accounts' }, { status: 500 });
    }
}

// POST /api/finance/petty-cash/accounts - Initialize new petty cash account
export async function POST(request: NextRequest) {
    try {
        await requireAuth();
        const body = await request.json();
        const { name, opmcId, imprestLimit, createdById } = body;

        if (!name || !opmcId || !imprestLimit || !createdById) {
            return NextResponse.json(
                { error: 'name, opmcId, imprestLimit, and createdById are required' },
                { status: 400 }
            );
        }

        const account = await PettyCashService.createPettyCashAccount({
            name,
            opmcId,
            imprestLimit: parseFloat(imprestLimit),
            createdById
        });

        return NextResponse.json(account, { status: 201 });
    } catch (error: unknown) {
        console.error('Error creating petty cash account:', error);
        const msg = error instanceof Error ? error.message : 'Failed to create petty cash account';
        if (msg === 'PETTY_CASH_ACCOUNT_ALREADY_EXISTS_FOR_OPMC') {
            return NextResponse.json({ error: 'A petty cash account already exists for this OPMC' }, { status: 400 });
        }
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
