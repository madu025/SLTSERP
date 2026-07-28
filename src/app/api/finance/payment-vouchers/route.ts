import { ROLE_GROUPS } from '@/config/roles';
import { apiHandler } from "@/lib/api-handler";
import { PaymentVoucherService } from "@/services/finance/payment-voucher.service";
import { z } from 'zod';


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

const createPVSchema = z.object({
    projectId: z.string(),
    title: z.string(),
    description: z.string().nullish(),
    type: z.string().optional(),
    payeeName: z.string(),
    payeeId: z.string().nullish(),
    invoiceId: z.string().nullish(),
    amount: z.number(),
    paymentDate: z.string().nullish(),
    paymentMethod: z.string().nullish(),
    bankName: z.string().nullish(),
    bankBranch: z.string().nullish(),
    accountNumber: z.string().nullish(),
    chequeNumber: z.string().nullish(),
    referenceNumber: z.string().nullish(),
    taxWithheld: z.number().optional(),
    netAmount: z.number().optional(),
    retentionAmount: z.number().optional(),
    retentionReleaseId: z.string().nullish(),
    notes: z.string().nullish(),
    contractorInvoiceId: z.string().nullish(),
});

// POST /api/finance/payment-vouchers - Create a new payment voucher
export const POST = apiHandler(async (req, _params, body) => {
    const userId = req.headers.get("x-user-id") ?? undefined;
    const payload = { ...body, createdById: userId };
    return await PaymentVoucherService.createPaymentVoucher(payload);
}, {
    schema: createPVSchema,
    roles: ROLE_GROUPS.FINANCE_APPROVERS,
    audit: { action: 'CREATE', entity: 'PAYMENT_VOUCHER' },
    rawResponse: true
});
