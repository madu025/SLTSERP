import { apiHandler } from "@/lib/api-handler";
import { PaymentVoucherService } from "@/services/finance/payment-voucher.service";

export const dynamic = 'force-dynamic';

// GET /api/finance/payment-vouchers - List payment vouchers with optional filters (rawResponse for compatibility)
export const GET = apiHandler(async (req) => {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") || undefined;
    const projectId = searchParams.get("projectId") || undefined;
    const type = searchParams.get("type") || undefined;

    return await PaymentVoucherService.getPaymentVouchers({ status, projectId, type });
}, {
    rawResponse: true
});

// POST /api/finance/payment-vouchers - Create a new payment voucher
export const POST = apiHandler(async (req, _params, body) => {
    const { projectId, title, payeeName, amount } = body;
    const userId = req.headers.get("x-user-id") || undefined;

    if (!projectId || !title || !payeeName || amount === undefined) {
        throw new Error("projectId, title, payeeName, and amount are required fields");
    }

    const payload = {
        ...body,
        createdById: userId
    };

    return await PaymentVoucherService.createPaymentVoucher(payload);
}, {
    roles: ['FINANCE_MANAGER', 'SUPER_ADMIN'],
    audit: { action: 'CREATE', entity: 'PAYMENT_VOUCHER' },
    rawResponse: true
});
