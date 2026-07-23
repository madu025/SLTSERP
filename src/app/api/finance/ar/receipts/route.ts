import { apiHandler } from '@/lib/api-handler';
import { prisma } from '@/lib/prisma';
import { ArApService } from '@/services/finance/ar-ap.service';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async () => {
    const receipts = await prisma.customerReceipt.findMany({
        include: {
            customer: true,
            invoice: true
        },
        orderBy: {
            receiptDate: 'desc'
        }
    });

    return receipts;
}, {
    roles: ['SUPER_ADMIN', 'ADMIN', 'FINANCE_MANAGER', 'FINANCE_ASSISTANT']
});

export const POST = apiHandler(async (req) => {
    const body = await req.json();

    const receipt = await prisma.$transaction(async (tx) => {
        return await ArApService.recordCustomerReceipt(tx, {
            receiptNumber: body.receiptNumber,
            customerId: body.customerId,
            invoiceId: body.invoiceId,
            amount: Number(body.amount),
            paymentMethod: body.paymentMethod,
            referenceNumber: body.referenceNumber,
            receiptDate: body.receiptDate ? new Date(body.receiptDate) : undefined,
            notes: body.notes,
            createdById: (req as any).user?.id
        });
    });

    return receipt;
}, {
    roles: ['SUPER_ADMIN', 'ADMIN', 'FINANCE_MANAGER']
});
