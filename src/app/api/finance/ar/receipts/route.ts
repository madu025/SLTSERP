import { ROLE_GROUPS } from '@/config/roles';
import { apiHandler } from '@/lib/api-handler';

import { ArApService } from '@/services/finance/ar-ap.service';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async () => {
    const receipts = await ArApService.getCustomerReceipts();
    return receipts;
}, {
    roles: ROLE_GROUPS.FINANCE_ALL
});

export const POST = apiHandler(async (req) => {
    const body = await req.json();

    const receipt = await ArApService.recordCustomerReceipt({
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

    return receipt;
}, {
    roles: ROLE_GROUPS.FINANCE_APPROVERS
});
