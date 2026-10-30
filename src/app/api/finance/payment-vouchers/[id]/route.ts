import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { assertProjectAccess } from '@/lib/project-access';
import { prisma } from '@/lib/prisma';
export const dynamic = 'force-dynamic';

import { AppError } from '@/lib/error';
import { apiHandler } from "@/lib/api-handler";
import { PaymentVoucherService } from "@/services/finance/payment-voucher.service";
import { z } from 'zod';

const updatePVSchema = z.object({
    title: z.string().optional(),
    description: z.string().nullish(),
    payeeName: z.string().optional(),
    amount: z.number().optional(),
    paymentDate: z.string().nullish(),
    paymentMethod: z.string().nullish(),
    bankName: z.string().nullish(),
    bankBranch: z.string().nullish(),
    accountNumber: z.string().nullish(),
    chequeNumber: z.string().nullish(),
    referenceNumber: z.string().nullish(),
    notes: z.string().nullish(),
});

// GET /api/finance/payment-vouchers/[id]
export const GET = apiHandler(async (_req, params) => {
    const voucher = await PaymentVoucherService.getPaymentVoucherById(params.id);
    if (!voucher) throw AppError.notFound('Payment voucher not found');
    await assertProjectAccess(voucher.projectId, params._userId);
    return voucher;
}, {
    permissions: [RBAC_PERMISSIONS.FINANCE_READ],
    rawResponse: true
});

// PUT /api/finance/payment-vouchers/[id] - Update payment voucher details (DRAFT only)
export const PUT = apiHandler(async (_req, params, body) => {
    const voucher = await prisma.paymentVoucher.findUnique({ where: { id: params.id }, select: { projectId: true } });
    if (!voucher) throw AppError.notFound('Payment voucher not found');
    await assertProjectAccess(voucher.projectId, params._userId);
    return await PaymentVoucherService.updatePaymentVoucher(params.id, body);
}, {
    schema: updatePVSchema,
    permissions: [RBAC_PERMISSIONS.FINANCE_WRITE],
    audit: { action: 'UPDATE', entity: 'PAYMENT_VOUCHER' },
    rawResponse: true
});

// DELETE /api/finance/payment-vouchers/[id] - Delete payment voucher (DRAFT only)
export const DELETE = apiHandler(async (_req, params) => {
    const voucher = await prisma.paymentVoucher.findUnique({ where: { id: params.id }, select: { projectId: true } });
    if (!voucher) throw AppError.notFound('Payment voucher not found');
    await assertProjectAccess(voucher.projectId, params._userId);
    return await PaymentVoucherService.deletePaymentVoucher(params.id);
}, {
    permissions: [RBAC_PERMISSIONS.FINANCE_APPROVE],
    audit: { action: 'DELETE', entity: 'PAYMENT_VOUCHER' },
    rawResponse: true
});
