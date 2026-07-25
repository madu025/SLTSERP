import { SODWipRevenueService } from '@/services/finance/sod-wip-revenue.service';
import { apiHandler } from '@/lib/api-handler';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// GET WIP Revenue Summary & Invoicable Pool
export const GET = apiHandler(async (request) => {
    const { searchParams } = new URL(request.url);
    const opmcId = searchParams.get('opmcId') || undefined;

    const data = await SODWipRevenueService.getWipSummary(opmcId);
    return data;
}, { rawResponse: true });

// POST Accrue WIP Revenue Journal into General Ledger
export const POST = apiHandler(async (request) => {
    const userId = request.headers.get('x-user-id') || undefined;
    const result = await SODWipRevenueService.postWipAccrualJournal(userId);
    return NextResponse.json(result);
});
