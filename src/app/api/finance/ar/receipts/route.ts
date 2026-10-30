import { apiHandler } from '@/lib/api-handler';
import { ArApService } from '@/services/finance/ar-ap.service';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { assertProjectAccess } from '@/lib/project-access';
import { prisma } from '@/lib/prisma';
import { AppError } from '@/lib/error';
import { userHasPermission } from '@/lib/user-permissions';
import { resolveOpmcScope } from '@/lib/opmc-scope';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const receiptSchema = z.object({
    receiptNumber: z.string().trim().max(80).optional(),
    customerId: z.string().uuid().optional(),
    invoiceId: z.string().uuid().optional(),
    amount: z.number().finite().positive(),
    paymentMethod: z.enum(['BANK_TRANSFER', 'CHEQUE', 'CASH']).optional(),
    referenceNumber: z.string().trim().max(120).optional(),
    receiptDate: z.string().datetime().optional(),
    notes: z.string().trim().max(1000).optional(),
});

export const GET = apiHandler(async (_request, params) => {
    const receipts = await ArApService.getCustomerReceipts(params._userId);
    return receipts;
}, {
    permissions: [RBAC_PERMISSIONS.FINANCE_READ]
});

export const POST = apiHandler(async (_req, params, body: z.infer<typeof receiptSchema>) => {
    if (!params._userId) throw AppError.unauthorized('Authentication required');
    if (!body.invoiceId && (!await userHasPermission(params._userId, RBAC_PERMISSIONS.FINANCE_APPROVE)
        || await resolveOpmcScope(params._userId) !== undefined)) {
        throw AppError.forbidden('A scoped receipt must be linked to an accessible project invoice');
    }
    if (body.invoiceId) {
        const invoice = await prisma.projectInvoice.findUnique({ where: { id: body.invoiceId }, select: { projectId: true } });
        if (!invoice) throw AppError.notFound('Invoice not found');
        await assertProjectAccess(invoice.projectId, params._userId);
    }

    const receipt = await ArApService.recordCustomerReceipt({
        ...body,
        receiptDate: body.receiptDate ? new Date(body.receiptDate) : undefined,
        createdById: params._userId,
    });

    return receipt;
}, {
    schema: receiptSchema,
    permissions: [RBAC_PERMISSIONS.FINANCE_APPROVE, RBAC_PERMISSIONS.PROJECT_FINANCE_APPROVE],
    permissionMode: 'any',
    audit: { action: 'CREATE', entity: 'CUSTOMER_RECEIPT' }
});
