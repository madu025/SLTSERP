import { apiHandler } from '@/lib/api-handler';
import PaymentService from '@/services/PaymentService';
import { PaymentTypeEnum, PaymentStatusEnum } from '@prisma/client';
import { PaymentType } from '@/types/vehicle-management.types';
import { createPaymentSchema, CreatePaymentSchema } from '@/lib/validations/payment.schema';

export const dynamic = 'force-dynamic';

interface PaymentFilter {
    payment_type?: PaymentTypeEnum;
    status?: PaymentStatusEnum;
    invoice_id?: string;
    from_date?: Date;
    to_date?: Date;
    page?: number;
    limit?: number;
}

/**
 * GET: List payments with filters
 */
export const GET = apiHandler<unknown, void>(
    async (request: Request) => {
        const { searchParams } = new URL(request.url);
        const payment_type = searchParams.get('payment_type');
        const status = searchParams.get('status');
        const invoice_id = searchParams.get('invoice_id');
        const from_date = searchParams.get('from_date');
        const to_date = searchParams.get('to_date');
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '20');

        const filters: PaymentFilter = {};
        if (payment_type) filters.payment_type = payment_type as PaymentTypeEnum;
        if (status) filters.status = status as PaymentStatusEnum;
        if (invoice_id) filters.invoice_id = invoice_id;
        if (from_date) filters.from_date = new Date(from_date);
        if (to_date) filters.to_date = new Date(to_date);
        filters.page = page;
        filters.limit = limit;

        // Cast filters as any to bypass dynamic Prisma types
        const { data, total } = await PaymentService.listPayments(filters as any);

        return {
            data,
            meta: { total, page, limit, pages: Math.ceil(total / limit) },
        };
    }
);

/**
 * POST: Create a new payment
 */
export const POST = apiHandler<unknown, CreatePaymentSchema>(
    async (request: Request, params: unknown, body) => {
        // Verify invoice exists using Service layer instead of direct prisma access
        const invoice = await PaymentService.getInvoice(body.invoice_id);
        if (!invoice) {
            throw new Error('Invoice not found');
        }

        const payment = await PaymentService.createPayment({
            invoice_id: body.invoice_id,
            payment_type: body.payment_type as unknown as PaymentType,
            reference_id: body.reference_id,
            base_amount: body.base_amount,
            tax_config_id: body.tax_config_id || undefined,
            payment_method: body.payment_method,
            payment_ref_number: body.payment_ref_number || undefined,
            due_date: new Date(body.due_date),
        });

        // Fire notification to finance managers (non-blocking)
        try {
            const { DomainNotificationPolicies } = await import('@/services/notification/domain-policies.service');
            await DomainNotificationPolicies.notifyPaymentReceived({
                id: (payment as any).id || '',
                amount: body.base_amount,
                payer: (invoice as any)?.client?.name || (invoice as any)?.clientName || 'Client',
                invoiceNumber: (invoice as any)?.invoiceNumber || body.invoice_id,
                projectId: (invoice as any)?.projectId || undefined,
            });
        } catch (e) {
            console.error('[PAYMENT-NOTIFY] Failed to send payment notification:', e);
        }

        return payment;
    },
    { schema: createPaymentSchema }
);
