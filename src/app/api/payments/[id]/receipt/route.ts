import { apiHandler } from '@/lib/api-handler';
import PaymentService from '@/services/PaymentService';
import { z } from 'zod';

const receiptSchema = z.object({
    payment_received_date: z.string().min(1, 'Missing payment_received_date'),
    payment_ref_number: z.string().optional()
});

export const POST = apiHandler(async (_req, params, body) => {
    const { id } = params;
    const data = receiptSchema.parse(body);

    const payment = await PaymentService.processFullPaymentReceipt(
        id,
        new Date(data.payment_received_date),
        data.payment_ref_number
    );

    return Response.json({ success: true, data: payment });
}, {
    audit: { action: 'RECORD_PAYMENT_RECEIPT', entity: 'Payment' }
});
