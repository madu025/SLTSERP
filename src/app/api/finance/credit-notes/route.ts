import { apiHandler } from '@/lib/api-handler';
import { prisma } from '@/lib/prisma';
import { PeriodCloseService } from '@/services/finance/period-close.service';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async () => {
    const notes = await prisma.creditDebitNote.findMany({
        include: {
            invoice: true
        },
        orderBy: {
            createdAt: 'desc'
        }
    });

    return notes;
}, {
    roles: ['SUPER_ADMIN', 'ADMIN', 'FINANCE_MANAGER', 'FINANCE_ASSISTANT']
});

export const POST = apiHandler(async (req) => {
    const body = await req.json();
    const userId = (req as Request & { user?: { id?: string } }).user?.id;

    const note = await prisma.$transaction(async (tx) => {
        return await PeriodCloseService.createCreditDebitNote(tx, {
            noteNumber: body.noteNumber,
            type: body.type,
            invoiceId: body.invoiceId,
            amount: Number(body.amount),
            reason: body.reason,
            createdById: userId
        });
    });

    return note;
}, {
    roles: ['SUPER_ADMIN', 'ADMIN', 'FINANCE_MANAGER']
});
