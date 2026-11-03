import { apiHandler } from '@/lib/api-handler';
import { AppError } from '@/lib/error';
import { z } from 'zod';

import { PayrollExpenseService } from '@/services/finance/payroll-expense.service';

export const dynamic = 'force-dynamic';

const payrollSchema = z.object({
    period: z.string().trim().min(1).max(32),
    opmcId: z.string().min(1).max(100),
    amount: z.number().finite().nonnegative(),
    referenceNumber: z.string().trim().max(100).optional(),
    notes: z.string().max(5000).optional(),
}).strict();
type PayrollRequest = z.infer<typeof payrollSchema>;

export const GET = apiHandler(async (req) => {
    const { searchParams } = new URL(req.url);
    const opmcId = searchParams.get('opmcId') || undefined;
    const period = searchParams.get('period') || undefined;

    const data = await PayrollExpenseService.getPayrollExpenses(opmcId, period);
    return data;
}, {
});

export const POST = apiHandler<unknown, PayrollRequest>(async (_req, params, body) => {
    const userId = params._userId;
    if (!userId) throw AppError.unauthorized('Authentication required');

    const record = await PayrollExpenseService.recordPayrollAllocation({
        period: body.period,
        opmcId: body.opmcId,
        amount: body.amount,
        referenceNumber: body.referenceNumber,
        notes: body.notes,
        createdById: userId
    });

    return record;
}, {
    schema: payrollSchema,
    audit: { action: 'CREATE', entity: 'PAYROLL_ALLOCATION' }
});
