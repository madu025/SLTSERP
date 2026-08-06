import { SODWipRevenueService } from '@/services/finance/sod-wip-revenue.service';
import { apiHandler } from '@/lib/api-handler';
import { ROLE_GROUPS } from '@/config/roles';
import { NextResponse } from 'next/server';
import { resolveOpmcScope } from '@/lib/opmc-scope';

export const dynamic = 'force-dynamic';

// GET WIP Revenue Summary & Invoicable Pool
export const GET = apiHandler(async (request, params) => {
    const { searchParams } = new URL(request.url);
    const opmcId = searchParams.get('opmcId') || undefined;

    // Server-side OPMC scope — client opmcId is intersected with it inside
    // the service (admins unrestricted, empty scope denies all).
    const accessibleOpmcs = await resolveOpmcScope(params._userId);

    const data = await SODWipRevenueService.getWipSummary(opmcId, accessibleOpmcs);
    return data;
}, { roles: [...ROLE_GROUPS.FINANCE, 'OSP_MANAGER'], rawResponse: true });

// POST Accrue WIP Revenue Journal into General Ledger
export const POST = apiHandler(async (request) => {
    const userId = request.headers.get('x-user-id') || undefined;
    const result = await SODWipRevenueService.postWipAccrualJournal(userId);
    return NextResponse.json(result);
}, {
    // GL journal posting — finance team scope only
    roles: ROLE_GROUPS.FINANCE,
    rawResponse: true,
    audit: { action: 'WIP_ACCRUAL_POST', entity: 'GLJournal' }
});
