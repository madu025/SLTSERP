import { apiHandler } from "@/lib/api-handler";
import { PaymentVoucherService } from "@/services/finance/payment-voucher.service";

type Params = Promise<{ id: string }>;

// PATCH /api/finance/payment-vouchers/[id]/status - Update payment voucher status
export const PATCH = apiHandler(async (req, params, body) => {
    const { id } = await (params as Params);
    const { status, rejectionReason, cancelledReason } = body;
    const userId = req.headers.get("x-user-id");

    if (!status || !userId) {
        throw new Error("status is required and user must be authenticated");
    }

    return await PaymentVoucherService.updatePaymentVoucherStatus(id, status, userId, {
        rejectionReason,
        cancelledReason
    });
}, {
    roles: ['FINANCE_MANAGER', 'SUPER_ADMIN'],
    audit: { action: 'UPDATE_STATUS', entity: 'PAYMENT_VOUCHER' },
    rawResponse: true
});
