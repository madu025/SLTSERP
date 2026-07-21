import { apiHandler } from '@/lib/api-handler';
import { QuotationService } from '@/services/quotation.service';
import { AppError } from '@/lib/error';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async (request) => {
    const { searchParams } = new URL(request.url);
    const requisitionId = searchParams.get('requisitionId');
    if (!requisitionId) throw AppError.badRequest('requisitionId is required');

    return await QuotationService.getQuotations(requisitionId);
}, { rawResponse: true });

const createQuotationSchema = z.object({
    requisitionId: z.string().min(1),
    vendorId: z.string().min(1),
    vendorName: z.string().optional(),
    quoteDate: z.string().optional(),
    validUntil: z.string().optional(),
    currency: z.string().optional(),
    deliveryDays: z.number().optional(),
    warrantyPeriod: z.union([z.string(), z.number()]).optional(),
    paymentTerms: z.string().optional(),
    remarks: z.string().optional(),
    items: z.array(z.object({
        itemCode: z.string().min(1),
        description: z.string().min(1),
        unit: z.string().optional(),
        quantity: z.number().min(0),
        unitPrice: z.number().min(0),
        deliveryDate: z.string().optional(),
        deliveryDays: z.number().optional(),
        notes: z.string().optional(),
    })).min(1),
});

export const POST = apiHandler(async (_request, _params, body) => {
    const data = createQuotationSchema.parse(body);
    
    try {
        const quotation = await QuotationService.createQuotation(data);
        return Response.json(quotation, { status: 201 });
    } catch (error: unknown) {
        if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
            throw AppError.badRequest('Quote number already exists');
        }
        throw error;
    }
}, {
    audit: { action: 'CREATE', entity: 'QUOTATION' },
    rawResponse: true
});

const updateQuotationSchema = z.object({
    id: z.string().min(1),
    status: z.string().min(1),
    acceptedById: z.string().optional(),
});

export const PATCH = apiHandler(async (_request, _params, body) => {
    const data = updateQuotationSchema.parse(body);
    return await QuotationService.updateQuotationStatus(data.id, data.status, data.acceptedById);
}, {
    audit: { action: 'UPDATE', entity: 'QUOTATION' },
    rawResponse: true
});
