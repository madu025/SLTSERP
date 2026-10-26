export const dynamic = 'force-dynamic';
import { AppError } from '@/lib/error';
import { apiHandler } from "@/lib/api-handler";
import { PaymentVoucherService } from "@/services/finance/payment-voucher.service";
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { z } from 'zod';

const updateStatusSchema = z.object({
    status: z.string(),
    rejectionReason: z.string().optional(),
    cancelledReason: z.string().optional(),
});

// PATCH /api/finance/payment-vouchers/[id]/status - Update payment voucher status
export const PATCH = apiHandler(async (req, params, body) => {
    const { status, rejectionReason, cancelledReason } = body;
    const userId = req.headers.get("x-user-id");

    if (!userId) throw AppError.unauthorized('Authentication required');

    return await PaymentVoucherService.updatePaymentVoucherStatus(params.id, status, userId, {
        rejectionReason,
        cancelledReason
    });
}, {
    schema: updateStatusSchema,
    permissions: [RBAC_PERMISSIONS.FINANCE_APPROVE],
    audit: { action: 'UPDATE_STATUS', entity: 'PAYMENT_VOUCHER' },
    rawResponse: true
});
