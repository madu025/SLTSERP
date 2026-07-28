import { ROLE_GROUPS } from '@/config/roles';
export const dynamic = 'force-dynamic';

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
    if (!voucher) throw new Error("VOUCHER_NOT_FOUND");
    return voucher;
}, {
    rawResponse: true
});

// PUT /api/finance/payment-vouchers/[id] - Update payment voucher details (DRAFT only)
export const PUT = apiHandler(async (_req, params, body) => {
    return await PaymentVoucherService.updatePaymentVoucher(params.id, body);
}, {
    schema: updatePVSchema,
    roles: ROLE_GROUPS.FINANCE_APPROVERS,
    audit: { action: 'UPDATE', entity: 'PAYMENT_VOUCHER' },
    rawResponse: true
});

// DELETE /api/finance/payment-vouchers/[id] - Delete payment voucher (DRAFT only)
export const DELETE = apiHandler(async (_req, params) => {
    return await PaymentVoucherService.deletePaymentVoucher(params.id);
}, {
    roles: ROLE_GROUPS.FINANCE_APPROVERS,
    audit: { action: 'DELETE', entity: 'PAYMENT_VOUCHER' },
    rawResponse: true
});
