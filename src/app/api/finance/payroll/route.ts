import { getAuthenticatedUserId } from '@/lib/request-context';
import { apiHandler } from '@/lib/api-handler';

import { PayrollExpenseService } from '@/services/finance/payroll-expense.service';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async (req) => {
    const { searchParams } = new URL(req.url);
    const opmcId = searchParams.get('opmcId') || undefined;
    const period = searchParams.get('period') || undefined;

    const data = await PayrollExpenseService.getPayrollExpenses(opmcId, period);
    return data;
}, {
});

export const POST = apiHandler(async (req) => {
    const body = await req.json();
    const userId = getAuthenticatedUserId() || (req as Request & { user?: { id?: string } }).user?.id || undefined;

    const record = await PayrollExpenseService.recordPayrollAllocation({
        period: body.period,
        opmcId: body.opmcId,
        amount: Number(body.amount),
        referenceNumber: body.referenceNumber,
        notes: body.notes,
        createdById: userId
    });

    return record;
}, {
    audit: { action: 'CREATE', entity: 'PAYROLL_ALLOCATION' }
});
