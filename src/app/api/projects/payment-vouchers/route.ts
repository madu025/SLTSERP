import { apiHandler } from '@/lib/api-handler';
import { assertHoTransition } from '@/lib/ho-voucher-access';
import { assertVoucherAccess } from '@/lib/payment-voucher-access';
import { PaymentVoucherService } from '@/services/finance/payment-voucher.service';
import { AppError } from '@/lib/error';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { userHasPermission } from '@/lib/user-permissions';
import { databaseUuidSchema } from '@/lib/validations/uuid.schema';
import { assertProjectAccess } from '@/lib/project-access';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const voucherSchema = z.object({
    projectId: databaseUuidSchema, title: z.string().trim().min(1), description: z.string().optional().nullable(),
    type: z.string().trim().min(1).optional(), payeeName: z.string().trim().min(1), payeeId: databaseUuidSchema.optional().nullable(),
    invoiceId: databaseUuidSchema.optional().nullable(), amount: z.number().finite().positive(), paymentDate: z.string().optional().nullable(),
    paymentMethod: z.string().optional().nullable(), bankName: z.string().optional().nullable(), bankBranch: z.string().optional().nullable(),
    accountNumber: z.string().optional().nullable(), chequeNumber: z.string().optional().nullable(), referenceNumber: z.string().optional().nullable(),
    taxWithheld: z.number().finite().min(0).optional(), retentionAmount: z.number().finite().min(0).optional(),
    retentionReleaseId: databaseUuidSchema.optional().nullable(), notes: z.string().optional().nullable(),
}).refine((data) => (data.taxWithheld ?? 0) + (data.retentionAmount ?? 0) <= data.amount, {
    message: 'Tax withheld and retention cannot exceed the voucher amount', path: ['amount'],
});

const voucherStatusSchema = z.object({
    id: databaseUuidSchema, status: z.enum(['PENDING_APPROVAL', 'APPROVED', 'SUBMITTED_TO_HO', 'PAID', 'REJECTED', 'CANCELLED']),
    rejectionReason: z.string().trim().min(1).optional(), cancelledReason: z.string().trim().min(1).optional(),
    hoReference: z.string().trim().max(120).optional(), hoPaidDate: z.string().optional(), returnReason: z.string().trim().max(500).optional(),
});

async function requireFinanceApprover(userId: string | null, action: string) {
    const allowed = await userHasPermission(userId, RBAC_PERMISSIONS.PROJECT_FINANCE_APPROVE)
        || await userHasPermission(userId, RBAC_PERMISSIONS.FINANCE_APPROVE);
    if (!allowed) throw AppError.forbidden(`A finance approver is required to ${action}`);
}

export const GET = apiHandler(async (request, params) => {
    const projectId = new URL(request.url).searchParams.get('projectId');
    if (!projectId) throw AppError.badRequest('projectId is required');
    await assertProjectAccess(projectId, params._userId);
    return PaymentVoucherService.getVouchers(projectId);
}, { permissions: [RBAC_PERMISSIONS.PROJECT_FINANCE_READ], rawResponse: true });

export const POST = apiHandler(async (_request, params, body: z.infer<typeof voucherSchema>) => {
    if (!params._userId) throw AppError.unauthorized('Authentication required');
    await assertProjectAccess(body.projectId, params._userId);
    const voucher = await PaymentVoucherService.createVoucher({ ...body, createdById: params._userId });
    return Response.json(voucher, { status: 201 });
}, {
    schema: voucherSchema, permissions: [RBAC_PERMISSIONS.PROJECT_FINANCE_WRITE],
    audit: { action: 'CREATE', entity: 'PAYMENT_VOUCHER' }, rawResponse: true
});

export const PATCH = apiHandler(async (_request, params, body: z.infer<typeof voucherStatusSchema>) => {
    if (!params._userId) throw AppError.unauthorized('Authentication required');
    const voucher = await prisma.paymentVoucher.findUnique({ where: { id: body.id }, select: { projectId: true, status: true } });
    if (!voucher) throw AppError.notFound('Payment voucher not found');
    await assertVoucherAccess(voucher.projectId, params._userId);
    const hoLeg = body.status === 'SUBMITTED_TO_HO' || body.status === 'PAID' || (body.status === 'APPROVED' && voucher.status === 'SUBMITTED_TO_HO');
    if (body.status !== 'PENDING_APPROVAL' && !hoLeg) {
        await requireFinanceApprover(params._userId, body.status.toLowerCase());
    }
    const { recordedOnBehalf } = await assertHoTransition(params._userId, voucher.status, body.status);
    try {
        return await PaymentVoucherService.updatePaymentVoucherStatus(body.id, body.status, params._userId, {
            rejectionReason: body.rejectionReason, cancelledReason: body.cancelledReason,
            hoReference: body.hoReference, hoPaidDate: body.hoPaidDate, returnReason: body.returnReason, recordedOnBehalf,
        });
    } catch (error: unknown) {
        if (error instanceof Error && error.message === 'VOUCHER_NOT_FOUND') throw AppError.notFound('Payment voucher not found');
        throw error;
    }
}, {
    schema: voucherStatusSchema, permissions: [RBAC_PERMISSIONS.PROJECT_FINANCE_WRITE, RBAC_PERMISSIONS.PROJECT_FINANCE_APPROVE],
    audit: { action: 'UPDATE_STATUS', entity: 'PAYMENT_VOUCHER' }, rawResponse: true
});

export const DELETE = apiHandler(async (request, params) => {
    const id = new URL(request.url).searchParams.get('id');
    if (!id) throw AppError.badRequest('id is required');
    const voucher = await prisma.paymentVoucher.findUnique({ where: { id }, select: { projectId: true } });
    if (!voucher) throw AppError.notFound('Payment voucher not found');
    await assertVoucherAccess(voucher.projectId, params._userId);
    try {
        await PaymentVoucherService.deleteVoucher(id);
        return { message: 'Payment voucher deleted successfully' };
    } catch (error: unknown) {
        if (error instanceof Error && error.message === 'PAYMENT_VOUCHER_NOT_FOUND') throw AppError.notFound('Payment voucher not found');
        if (error instanceof Error && error.message === 'DRAFT_ONLY_DELETION') throw AppError.badRequest('Only DRAFT payment vouchers can be deleted');
        throw error;
    }
}, {
    permissions: [RBAC_PERMISSIONS.PROJECT_FINANCE_APPROVE],
    audit: { action: 'DELETE', entity: 'PAYMENT_VOUCHER' }, rawResponse: true
});
