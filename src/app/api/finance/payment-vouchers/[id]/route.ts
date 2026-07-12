import { apiHandler } from "@/lib/api-handler";
import { PaymentVoucherService } from "@/services/finance/payment-voucher.service";

type Params = Promise<{ id: string }>;

// GET /api/finance/payment-vouchers/[id] - Get payment voucher by ID
export const GET = apiHandler(async (req, params) => {
    const { id } = await (params as Params);
    const voucher = await PaymentVoucherService.getPaymentVoucherById(id);
    
    if (!voucher) {
        throw new Error("VOUCHER_NOT_FOUND");
    }
    
    return voucher;
}, {
    rawResponse: true
});

// PUT /api/finance/payment-vouchers/[id] - Update payment voucher details (DRAFT only)
export const PUT = apiHandler(async (req, params, body) => {
    const { id } = await (params as Params);
    return await PaymentVoucherService.updatePaymentVoucher(id, body);
}, {
    roles: ['FINANCE_MANAGER', 'SUPER_ADMIN'],
    audit: { action: 'UPDATE', entity: 'PAYMENT_VOUCHER' },
    rawResponse: true
});

// DELETE /api/finance/payment-vouchers/[id] - Delete payment voucher (DRAFT only)
export const DELETE = apiHandler(async (req, params) => {
    const { id } = await (params as Params);
    return await PaymentVoucherService.deletePaymentVoucher(id);
}, {
    roles: ['FINANCE_MANAGER', 'SUPER_ADMIN'],
    audit: { action: 'DELETE', entity: 'PAYMENT_VOUCHER' },
    rawResponse: true
});
