import { apiHandler } from '@/lib/api-handler';
import { ProjectInvoiceService } from '@/services/project/project-invoice.service';
import { AppError } from '@/lib/error';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { userHasPermission } from '@/lib/user-permissions';
import { assertProjectAccess } from '@/lib/project-access';
import { prisma } from '@/lib/prisma';
import { databaseUuidSchema } from '@/lib/validations/uuid.schema';
import { z } from 'zod';
import { assertProjectFinanceAssignment } from '@/services/project/project-finance-assignment.service';

export const dynamic = 'force-dynamic';

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
    status: z.enum(['ISSUED', 'SUBMIT_TO_SLT', 'MARK_OVERDUE', 'CANCELLED', 'FOLLOW_UP', 'COMPLETED']).optional(),
    cancelledReason: z.string().trim().min(1).optional(),
    title: z.string().trim().min(1).optional(),
    description: z.string().optional().nullable(),
    dueDate: z.string().optional().nullable(),
    notes: z.string().optional().nullable(),
    followUpNotes: z.string().optional().nullable(),
    submissionReference: z.string().trim().max(120).optional().nullable(),
    submissionNotes: z.string().trim().max(1000).optional().nullable(),
}).refine((data) => data.status || data.title || data.description !== undefined || data.dueDate !== undefined || data.notes !== undefined || data.followUpNotes !== undefined, {
    message: 'At least one permitted invoice update is required',
});

async function requireFinanceApprover(userId: string | null) {
    const allowed = await userHasPermission(userId, RBAC_PERMISSIONS.PROJECT_FINANCE_APPROVE)
        || await userHasPermission(userId, RBAC_PERMISSIONS.FINANCE_APPROVE);
    if (!allowed) throw AppError.forbidden('A finance approver is required for this invoice action');
}

export const GET = apiHandler(async (request, params) => {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');
    const allClient = searchParams.get('allClient') === 'true';

    if (allClient) return ProjectInvoiceService.getAllClientInvoices(params._userId);
    if (!projectId) throw AppError.badRequest('projectId is required');
    await assertProjectAccess(projectId, params._userId);
    return ProjectInvoiceService.getInvoices(projectId);
}, { permissions: [RBAC_PERMISSIONS.PROJECT_FINANCE_READ], rawResponse: true });

export const POST = apiHandler(async (_request, params, body: z.infer<typeof createInvoiceSchema>) => {
    if (!params._userId) throw AppError.unauthorized('Authentication required');
    await assertProjectAccess(body.projectId, params._userId);
    await assertProjectFinanceAssignment(body.projectId, params._userId, ['PREPARER', 'LEAD_CONTROLLER']);
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
    permissions: [RBAC_PERMISSIONS.PROJECT_FINANCE_WRITE],
    audit: { action: 'CREATE', entity: 'INVOICE' },
    rawResponse: true
});

export const PATCH = apiHandler(async (_request, params, body: z.infer<typeof updateInvoiceSchema>) => {
    if (!params._userId) throw AppError.unauthorized('Authentication required');
    const invoice = await prisma.projectInvoice.findUnique({ where: { id: body.id }, select: { projectId: true, createdById: true } });
    if (!invoice) throw AppError.notFound('Invoice not found');
    await assertProjectAccess(invoice.projectId, params._userId);
    if (body.status) {
        await requireFinanceApprover(params._userId);
        await assertProjectFinanceAssignment(invoice.projectId, params._userId, ['APPROVER', 'LEAD_CONTROLLER']);
        if (invoice.createdById === params._userId && !await userHasPermission(params._userId, RBAC_PERMISSIONS.ADMIN_RBAC)) {
            throw AppError.forbidden('Invoice creator cannot approve their own invoice');
        }
    } else {
        await assertProjectFinanceAssignment(invoice.projectId, params._userId, ['PREPARER', 'LEAD_CONTROLLER']);
    }
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
    permissions: [RBAC_PERMISSIONS.PROJECT_FINANCE_WRITE, RBAC_PERMISSIONS.PROJECT_FINANCE_APPROVE],
    audit: { action: 'UPDATE', entity: 'INVOICE' },
    rawResponse: true
});

export const DELETE = apiHandler(async (request, params) => {
    const id = new URL(request.url).searchParams.get('id');
    if (!id) throw AppError.badRequest('id is required');
    const invoice = await prisma.projectInvoice.findUnique({ where: { id }, select: { projectId: true } });
    if (!invoice) throw AppError.notFound('Invoice not found');
    await assertProjectAccess(invoice.projectId, params._userId);
    await assertProjectFinanceAssignment(invoice.projectId, params._userId!, ['APPROVER', 'LEAD_CONTROLLER']);
    try {
        await ProjectInvoiceService.deleteInvoice(id);
        return { message: 'Invoice deleted successfully' };
    } catch (error: unknown) {
        if (error instanceof Error && error.message === 'INVOICE_NOT_FOUND') throw AppError.notFound('Invoice not found');
        if (error instanceof Error && error.message === 'DRAFT_ONLY_DELETION') throw AppError.badRequest('Only DRAFT invoices can be deleted');
        throw error;
    }
}, {
    permissions: [RBAC_PERMISSIONS.PROJECT_FINANCE_APPROVE],
    audit: { action: 'DELETE', entity: 'INVOICE' },
    rawResponse: true
});
