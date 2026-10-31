import { apiHandler } from '@/lib/api-handler';
import { PeriodCloseService } from '@/services/finance/period-close.service';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { z } from 'zod';
import { AppError } from '@/lib/error';

export const dynamic = 'force-dynamic';

const noteSchema = z.object({
    noteNumber: z.string().trim().max(80).optional(),
    type: z.enum(['CREDIT_NOTE', 'DEBIT_NOTE']).default('CREDIT_NOTE'),
    invoiceId: z.string().uuid().optional(),
    amount: z.number().finite().positive().refine((value) => Number.isInteger(value * 100), 'Amount must have at most two decimal places'),
    reason: z.string().trim().min(2).max(1000),
});

export const GET = apiHandler(async (_req, params) => {
    const notes = await PeriodCloseService.getCreditDebitNotes(params._userId);
    return notes;
}, {
    permissions: [RBAC_PERMISSIONS.FINANCE_READ]
});

export const POST = apiHandler(async (_req, params, body: z.infer<typeof noteSchema>) => {
    if (!params._userId) throw AppError.unauthorized('Authentication required');
    const note = await PeriodCloseService.createCreditDebitNote({
        noteNumber: body.noteNumber,
        type: body.type,
        invoiceId: body.invoiceId,
        amount: body.amount,
        reason: body.reason,
        createdById: params._userId
    });

    return note;
}, {
    schema: noteSchema,
    permissions: [RBAC_PERMISSIONS.FINANCE_APPROVE],
    audit: { action: 'CREATE', entity: 'CREDIT_DEBIT_NOTE' }
});
