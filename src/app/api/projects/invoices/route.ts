import { apiHandler } from '@/lib/api-handler';
import { ProjectInvoiceService } from '@/services/project/project-invoice.service';
import { AppError } from '@/lib/error';
import { ROLE_GROUPS } from '@/config/roles';
import { assertProjectAccess } from '@/lib/project-access';
import { prisma } from '@/lib/prisma';
import { databaseUuidSchema } from '@/lib/validations/uuid.schema';
import { z } from 'zod';

export const dynamic = 'force-dynamic';
const PROJECT_FINANCE_READERS = [...new Set([...ROLE_GROUPS.PROJECT_MANAGERS, ...ROLE_GROUPS.FINANCE])];

const createInvoiceSchema = z.object({
    projectId: databaseUuidSchema,
    title: z.string().trim().min(1),
    description: z.string().optional().nullable(),
    type: z.enum(['CLIENT', 'CONTRACTOR', 'INTERNAL']).optional(),
    contractorId: databaseUuidSchema.optional().nullable(),
    invoiceDate: z.string().optional(),
    dueDate: z.string().optional().nullable(),
    referenceNumber: z.string().optional().nullable(),
    periodFrom: z.string().optional().nullable(),
    periodTo: z.string().optional().nullable(),
    currency: z.string().trim().min(3).max(3).optional(),
    notes: z.string().optional().nullable(),
    taxAmount: z.number().finite().min(0).optional(),
    discountAmount: z.number().finite().min(0).optional(),
    items: z.array(z.object({
        description: z.string().trim().min(1),
        quantity: z.number().finite().positive().optional(),
        unitPrice: z.number().finite().min(0).optional(),
        boqItemId: databaseUuidSchema.optional().nullable(),
        taskId: databaseUuidSchema.optional().nullable(),
        itemType: z.string().trim().min(1).optional(),
        notes: z.string().optional().nullable(),
    })).min(1),
}).superRefine((data, ctx) => {
    const subtotal = data.items.reduce((sum, item) => sum + (item.quantity ?? 1) * (item.unitPrice ?? 0), 0);
    const total = subtotal + (data.taxAmount ?? 0) - (data.discountAmount ?? 0);
    if (total <= 0 || data.discountAmount !== undefined && data.discountAmount > subtotal + (data.taxAmount ?? 0)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['items'], message: 'Invoice total must be positive after discounts' });
    }
});

const updateInvoiceSchema = z.object({
    id: databaseUuidSchema,
    status: z.enum(['ISSUED', 'CANCELLED', 'FOLLOW_UP', 'COMPLETED']).optional(),
    cancelledReason: z.string().trim().min(1).optional(),
    title: z.string().trim().min(1).optional(),
    description: z.string().optional().nullable(),
    dueDate: z.string().optional().nullable(),
    notes: z.string().optional().nullable(),
    followUpNotes: z.string().optional().nullable(),
}).refine((data) => data.status || data.title || data.description !== undefined || data.dueDate !== undefined || data.notes !== undefined || data.followUpNotes !== undefined, {
    message: 'At least one permitted invoice update is required',
});

function requireFinanceApprover(userId: string | null, role: string | null) {
    if (!userId || !role || !ROLE_GROUPS.FINANCE_APPROVERS.includes(role)) {
        throw AppError.forbidden('A finance approver is required for this invoice action');
    }
}

export const GET = apiHandler(async (request, params) => {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');
    const allClient = searchParams.get('allClient') === 'true';

    if (allClient) return ProjectInvoiceService.getAllClientInvoices();
    if (!projectId) throw AppError.badRequest('projectId is required');
    await assertProjectAccess(projectId, params._userId);
    return ProjectInvoiceService.getInvoices(projectId);
}, { roles: PROJECT_FINANCE_READERS, rawResponse: true });

export const POST = apiHandler(async (_request, params, body: z.infer<typeof createInvoiceSchema>) => {
    if (!params._userId) throw AppError.unauthorized('Authentication required');
    await assertProjectAccess(body.projectId, params._userId);
    try {
        const invoice = await ProjectInvoiceService.createInvoice({ ...body, createdById: params._userId });
        return Response.json(invoice, { status: 201 });
    } catch (error: unknown) {
        if (error instanceof Error && error.message === 'PROJECT_NOT_FOUND') {
            throw AppError.notFound('Project not found');
        }
        throw error;
    }
}, {
    schema: createInvoiceSchema,
    roles: ROLE_GROUPS.FINANCE,
    audit: { action: 'CREATE', entity: 'INVOICE' },
    rawResponse: true
});

export const PATCH = apiHandler(async (_request, params, body: z.infer<typeof updateInvoiceSchema>) => {
    if (!params._userId) throw AppError.unauthorized('Authentication required');
    const invoice = await prisma.projectInvoice.findUnique({ where: { id: body.id }, select: { projectId: true } });
    if (!invoice) throw AppError.notFound('Invoice not found');
    await assertProjectAccess(invoice.projectId, params._userId);
    if (body.status) requireFinanceApprover(params._userId, params._userRole);
    const { id, ...updateFields } = body;
    try {
        return await ProjectInvoiceService.updateInvoice(id, updateFields, params._userId);
    } catch (error: unknown) {
        if (error instanceof Error && error.message === 'INVOICE_NOT_FOUND') {
            throw AppError.notFound('Invoice not found');
        }
        throw error;
    }
}, {
    schema: updateInvoiceSchema,
    roles: ROLE_GROUPS.FINANCE,
    audit: { action: 'UPDATE', entity: 'INVOICE' },
    rawResponse: true
});

export const DELETE = apiHandler(async (request, params) => {
    const id = new URL(request.url).searchParams.get('id');
    if (!id) throw AppError.badRequest('id is required');
    const invoice = await prisma.projectInvoice.findUnique({ where: { id }, select: { projectId: true } });
    if (!invoice) throw AppError.notFound('Invoice not found');
    await assertProjectAccess(invoice.projectId, params._userId);
    try {
        await ProjectInvoiceService.deleteInvoice(id);
        return { message: 'Invoice deleted successfully' };
    } catch (error: unknown) {
        if (error instanceof Error && error.message === 'INVOICE_NOT_FOUND') throw AppError.notFound('Invoice not found');
        if (error instanceof Error && error.message === 'DRAFT_ONLY_DELETION') throw AppError.badRequest('Only DRAFT invoices can be deleted');
        throw error;
    }
}, {
    roles: ROLE_GROUPS.FINANCE_APPROVERS,
    audit: { action: 'DELETE', entity: 'INVOICE' },
    rawResponse: true
});
