import { apiHandler } from '@/lib/api-handler';
import { prisma } from '@/lib/prisma';
import { PayrollExpenseService } from '@/services/finance/payroll-expense.service';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async (req) => {
    const { searchParams } = new URL(req.url);
    const opmcId = searchParams.get('opmcId') || undefined;
    const period = searchParams.get('period') || undefined;

    const data = await PayrollExpenseService.getPayrollExpenses(opmcId, period);
    return data;
}, {
    roles: ['SUPER_ADMIN', 'ADMIN', 'FINANCE_MANAGER', 'FINANCE_ASSISTANT']
});

export const POST = apiHandler(async (req) => {
    const body = await req.json();
    const userId = req.headers.get('x-user-id') || (req as Request & { user?: { id?: string } }).user?.id || undefined;

    const record = await prisma.$transaction(async (tx) => {
        return await PayrollExpenseService.recordPayrollAllocation(tx, {
            period: body.period,
            opmcId: body.opmcId,
            amount: Number(body.amount),
            referenceNumber: body.referenceNumber,
            notes: body.notes,
            createdById: userId
        });
    });

    return record;
}, {
    roles: ['SUPER_ADMIN', 'ADMIN', 'FINANCE_MANAGER']
});
