import { z } from 'zod';
import { apiHandler } from '@/lib/api-handler';
import { AppError } from '@/lib/error';
import { prisma } from '@/lib/prisma';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { databaseUuidSchema } from '@/lib/validations/uuid.schema';
import { assertRecordProjectAccess, getAccessibleProjectIds } from '@/lib/project-record-access';
import { QuotationAwardService } from '@/services/procurement/quotation-award.service';

export const dynamic = 'force-dynamic';

const request = z.object({ action: z.literal('REQUEST'), requisitionId: databaseUuidSchema, vendorIds: z.array(databaseUuidSchema).min(1).max(20) });
const submit = z.object({
    action: z.literal('SUBMIT_QUOTE'),
    quotationId: databaseUuidSchema,
    validUntil: z.string().nullish(),
    deliveryDays: z.number().int().min(0).nullish(),
    paymentTerms: z.string().max(200).nullish(),
    warrantyPeriod: z.string().max(100).nullish(),
    prices: z.array(z.object({ requisitionItemId: databaseUuidSchema, unitPrice: z.number().min(0), deliveryDays: z.number().int().min(0).nullish() })).min(1),
});
const award = z.object({ action: z.literal('AWARD'), quotationId: databaseUuidSchema, reason: z.string().max(500).nullish() });
const bodySchema = z.discriminatedUnion('action', [request, submit, award]);

// GET /api/procurement/rfq                    -> approved requisitions you can see, with quotation counts
// GET /api/procurement/rfq?requisitionId=<id> -> the comparison matrix for one requisition
export const GET = apiHandler(async (req, params) => {
    const sp = new URL(req.url).searchParams;
    const requisitionId = sp.get('requisitionId');
    if (requisitionId) {
        await assertRecordProjectAccess('requisition', requisitionId, params._userId);
        return QuotationAwardService.compare(requisitionId);
    }
    const accessible = await getAccessibleProjectIds(params._userId);
    const rows = await prisma.projectRequisition.findMany({
        where: { status: 'APPROVED', ...(accessible ? { projectId: { in: [...accessible] } } : {}) },
        orderBy: { createdAt: 'desc' },
        take: 200,
        select: { id: true, prNumber: true, title: true, projectId: true, requiredDate: true, _count: { select: { items: true, quotations: true } }, quotations: { select: { status: true } } },
    });
    return rows.map((r) => ({
        id: r.id, prNumber: r.prNumber, title: r.title, projectId: r.projectId, requiredDate: r.requiredDate, items: r._count.items, quotations: r._count.quotations,
        received: r.quotations.filter((q) => q.status === 'RECEIVED').length, awarded: r.quotations.some((q) => q.status === 'ACCEPTED'),
    }));
}, { permissions: [RBAC_PERMISSIONS.PROCUREMENT_READ] });

// POST /api/procurement/rfq  { action: REQUEST | SUBMIT_QUOTE | AWARD, ... }
export const POST = apiHandler(async (_req, params, body: z.infer<typeof bodySchema>) => {
    const userId = params._userId;
    if (!userId) throw AppError.unauthorized('Authentication required');
    switch (body.action) {
        case 'REQUEST':
            await assertRecordProjectAccess('requisition', body.requisitionId, userId);
            return QuotationAwardService.requestQuotations(body.requisitionId, body.vendorIds, userId);
        case 'SUBMIT_QUOTE': {
            const q = await prisma.quotation.findUnique({ where: { id: body.quotationId }, select: { requisitionId: true } });
            if (!q) throw AppError.notFound('Quotation not found');
            await assertRecordProjectAccess('requisition', q.requisitionId, userId);
            return QuotationAwardService.submitQuote({ ...body, userId });
        }
        case 'AWARD': {
            const q = await prisma.quotation.findUnique({ where: { id: body.quotationId }, select: { requisitionId: true } });
            if (!q) throw AppError.notFound('Quotation not found');
            await assertRecordProjectAccess('requisition', q.requisitionId, userId);
            return QuotationAwardService.award(body.quotationId, userId, body.reason);
        }
    }
}, {
    schema: bodySchema,
    permissions: [RBAC_PERMISSIONS.PROCUREMENT_WRITE],
    audit: { action: 'RFQ_ACTION', entity: 'QUOTATION', entityIdParam: 'quotationId' },
});
