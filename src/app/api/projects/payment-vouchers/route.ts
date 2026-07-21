import { apiHandler } from '@/lib/api-handler';
import { PaymentVoucherService } from '@/services/finance/payment-voucher.service';
import { AppError } from '@/lib/error';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async (request) => {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');

    if (!projectId) {
        throw AppError.badRequest('projectId is required');
    }

    return await PaymentVoucherService.getVouchers(projectId);
}, { rawResponse: true });

export const POST = apiHandler(async (_request, _params, body) => {
    const { projectId, title, payeeName, amount } = body || {};

    if (!projectId || !title || !payeeName || !amount) {
        throw AppError.badRequest('projectId, title, payeeName, and amount are required');
    }

    const voucher = await PaymentVoucherService.createVoucher(body);
    return Response.json(voucher, { status: 201 });
}, {
    audit: { action: 'CREATE', entity: 'PAYMENT_VOUCHER' },
    rawResponse: true
});

export const PATCH = apiHandler(async (_request, _params, body) => {
    const { id, status, ...options } = body || {};

    if (!id || !status) {
        throw AppError.badRequest('id and status are required');
    }

    try {
        return await PaymentVoucherService.updateVoucherStatus(id, status, options);
    } catch (error: unknown) {
        const errorMsg = error instanceof Error ? error.message : '';
        if (errorMsg === 'PAYMENT_VOUCHER_NOT_FOUND') {
            throw AppError.notFound('Payment voucher not found');
        }
        if (errorMsg === 'APPROVED_BY_ID_REQUIRED') {
            throw AppError.badRequest('approvedById is required');
        }
        throw error;
    }
}, {
    audit: { action: 'UPDATE_STATUS', entity: 'PAYMENT_VOUCHER' },
    rawResponse: true
});

export const DELETE = apiHandler(async (request) => {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
        throw AppError.badRequest('id is required');
    }

    try {
        await PaymentVoucherService.deleteVoucher(id);
        return { message: 'Payment voucher deleted successfully' };
    } catch (error: unknown) {
        const errorMsg = error instanceof Error ? error.message : '';
        if (errorMsg === 'PAYMENT_VOUCHER_NOT_FOUND') {
            throw AppError.notFound('Payment voucher not found');
        }
        if (errorMsg === 'DRAFT_ONLY_DELETION') {
            throw AppError.badRequest('Only DRAFT payment vouchers can be deleted');
        }
        throw error;
    }
}, {
    audit: { action: 'DELETE', entity: 'PAYMENT_VOUCHER' },
    rawResponse: true
});
