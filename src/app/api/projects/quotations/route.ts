import { apiHandler } from '@/lib/api-handler';
import { QuotationService } from '@/services/finance/quotation.service';
import { AppError } from '@/lib/error';
import { z } from 'zod';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { assertRecordProjectAccess, requireUserId } from '@/lib/project-record-access';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async (request, params) => {
    const { searchParams } = new URL(request.url);
    const requisitionId = searchParams.get('requisitionId');
    if (!requisitionId) throw AppError.badRequest('requisitionId is required');

    await assertRecordProjectAccess('requisition', requisitionId, params._userId);
    return await QuotationService.getQuotations(requisitionId);
}, { permissions: [RBAC_PERMISSIONS.PROCUREMENT_READ], rawResponse: true });

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

export const POST = apiHandler(async (_request, params, body) => {
    const data = createQuotationSchema.parse(body);
    await assertRecordProjectAccess('requisition', data.requisitionId, params._userId);
    
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
    permissions: [RBAC_PERMISSIONS.PROCUREMENT_WRITE],
    audit: { action: 'CREATE', entity: 'QUOTATION' },
    rawResponse: true
});

const updateQuotationSchema = z.object({
    id: z.string().min(1),
    status: z.string().min(1),
    acceptedById: z.string().optional(),
});

export const PATCH = apiHandler(async (_request, params, body) => {
    const data = updateQuotationSchema.parse(body);
    await assertRecordProjectAccess('quotation', data.id, params._userId);
    // Acceptor is always the authenticated user; a client-supplied acceptedById is ignored.
    return await QuotationService.updateQuotationStatus(data.id, data.status, requireUserId(params._userId));
}, {
    permissions: [RBAC_PERMISSIONS.PROCUREMENT_WRITE],
    audit: { action: 'UPDATE', entity: 'QUOTATION' },
    rawResponse: true
});
