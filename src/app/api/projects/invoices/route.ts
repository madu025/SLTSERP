import { apiHandler } from '@/lib/api-handler';
import { ProjectInvoiceService } from '@/services/project/project-invoice.service';
import { AppError } from '@/lib/error';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async (request) => {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');
    const allClient = searchParams.get('allClient') === 'true';

    if (allClient) {
        return await ProjectInvoiceService.getAllClientInvoices();
    }

    if (!projectId) {
        throw AppError.badRequest('projectId is required');
    }

    return await ProjectInvoiceService.getInvoices(projectId);
}, { rawResponse: true });

export const POST = apiHandler(async (_request, _params, body) => {
    const { projectId, title, items } = body || {};

    if (!projectId || !title || !items?.length) {
        throw AppError.badRequest('projectId, title, and items are required');
    }

    try {
        const invoice = await ProjectInvoiceService.createInvoice(body);
        return Response.json(invoice, { status: 201 });
    } catch (error: unknown) {
        const errorMsg = error instanceof Error ? error.message : '';
        if (errorMsg === 'PROJECT_NOT_FOUND') {
            throw AppError.notFound('Project not found');
        }
        throw error;
    }
}, {
    audit: { action: 'CREATE', entity: 'INVOICE' },
    rawResponse: true
});

export const PATCH = apiHandler(async (_request, _params, body) => {
    const { id, ...updateFields } = body || {};

    if (!id) {
        throw AppError.badRequest('id is required');
    }

    try {
        return await ProjectInvoiceService.updateInvoice(id, updateFields);
    } catch (error: unknown) {
        const errorMsg = error instanceof Error ? error.message : '';
        if (errorMsg === 'INVOICE_NOT_FOUND') {
            throw AppError.notFound('Invoice not found');
        }
        throw error;
    }
}, {
    audit: { action: 'UPDATE', entity: 'INVOICE' },
    rawResponse: true
});

export const DELETE = apiHandler(async (request) => {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
        throw AppError.badRequest('id is required');
    }

    try {
        await ProjectInvoiceService.deleteInvoice(id);
        return { message: 'Invoice deleted successfully' };
    } catch (error: unknown) {
        const errorMsg = error instanceof Error ? error.message : '';
        if (errorMsg === 'INVOICE_NOT_FOUND') {
            throw AppError.notFound('Invoice not found');
        }
        if (errorMsg === 'DRAFT_ONLY_DELETION') {
            throw AppError.badRequest('Only DRAFT invoices can be deleted');
        }
        throw error;
    }
}, {
    audit: { action: 'DELETE', entity: 'INVOICE' },
    rawResponse: true
});
