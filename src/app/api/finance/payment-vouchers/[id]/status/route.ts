import { getAuthenticatedUserId } from '@/lib/request-context';
import { assertVoucherAccess } from '@/lib/payment-voucher-access';
import { assertHoTransition } from '@/lib/ho-voucher-access';
export const dynamic = 'force-dynamic';
import { AppError } from '@/lib/error';
import { apiHandler } from "@/lib/api-handler";
import { PaymentVoucherService } from "@/services/finance/payment-voucher.service";
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';

const updateStatusSchema = z.object({
    status: z.string(),
    rejectionReason: z.string().optional(),
    cancelledReason: z.string().optional(),
    hoReference: z.string().trim().max(120).optional(),
    hoPaidDate: z.string().optional(),
    returnReason: z.string().trim().max(500).optional(),
});

// PATCH /api/finance/payment-vouchers/[id]/status - Update payment voucher status
export const PATCH = apiHandler(async (req, params, body) => {
    const { status, rejectionReason, cancelledReason, hoReference, hoPaidDate, returnReason } = body;
    const userId = getAuthenticatedUserId();
    if (!userId) throw AppError.unauthorized('Authentication required');
    const voucher = await prisma.paymentVoucher.findUnique({ where: { id: params.id }, select: { projectId: true, status: true } });
    if (!voucher) throw AppError.notFound('Payment voucher not found');
    await assertVoucherAccess(voucher.projectId, userId);
    // Makers (finance.write) submit for approval or cancel; approving and rejecting are approver actions; the Head Office
    // legs (submit, confirm paid, return) have their own capabilities
    const hoLeg = status === 'SUBMITTED_TO_HO' || status === 'PAID' || (status === 'APPROVED' && voucher.status === 'SUBMITTED_TO_HO');
    if (!hoLeg && status !== 'PENDING_APPROVAL' && status !== 'CANCELLED' && !(params._permissions ?? []).includes(RBAC_PERMISSIONS.FINANCE_APPROVE)) {
        throw AppError.forbidden('finance.approve is required for this voucher transition.');
    }
    const { recordedOnBehalf } = await assertHoTransition(userId, voucher.status, status);

    return await PaymentVoucherService.updatePaymentVoucherStatus(params.id, status, userId, {
        rejectionReason,
        cancelledReason,
        hoReference,
        hoPaidDate,
        returnReason,
        recordedOnBehalf,
    });
}, {
    schema: updateStatusSchema,
    permissions: [RBAC_PERMISSIONS.FINANCE_WRITE, RBAC_PERMISSIONS.FINANCE_APPROVE],
    audit: { action: 'UPDATE_STATUS', entity: 'PAYMENT_VOUCHER' },
    rawResponse: true
});
