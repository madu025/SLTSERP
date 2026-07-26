import { apiHandler } from '@/lib/api-handler';

import { PeriodCloseService } from '@/services/finance/period-close.service';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async () => {
    const notes = await PeriodCloseService.getCreditDebitNotes();
    return notes;
}, {
    roles: ['SUPER_ADMIN', 'ADMIN', 'FINANCE_MANAGER', 'FINANCE_ASSISTANT']
});

export const POST = apiHandler(async (req) => {
    const body = await req.json();
    const userId = req.headers.get('x-user-id') || (req as Request & { user?: { id?: string } }).user?.id || undefined;

    const note = await PeriodCloseService.createCreditDebitNote({
        noteNumber: body.noteNumber,
        type: body.type,
        invoiceId: body.invoiceId,
        amount: Number(body.amount),
        reason: body.reason,
        createdById: userId
    });

    return note;
}, {
    roles: ['SUPER_ADMIN', 'ADMIN', 'FINANCE_MANAGER']
});
