import { apiHandler } from '@/lib/api-handler';
import { InvoiceService } from '@/services/invoice/invoice.service';
import { createInvoiceSchema, updateInvoiceSchema, CreateInvoiceDTO, UpdateInvoiceDTO } from '@/lib/validations/invoice.schema';
import { AppError, ErrorCode } from '@/lib/error';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';

export const dynamic = 'force-dynamic';

/**
 * GET: Fetch all invoices with filters
 */
export const GET = apiHandler(async (request: Request, params) => {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || undefined;
    const contractorId = searchParams.get('contractorId') || undefined;
    const projectId = searchParams.get('projectId') || undefined;

    return await InvoiceService.getInvoices({ status, contractorId, projectId }, params._userId);
}, { permissions: [RBAC_PERMISSIONS.SOD_INVOICE] });

/**
 * POST: Create a new invoice
 */
export const POST = apiHandler(
    async (_request: Request, params, body: CreateInvoiceDTO) => {
        return await InvoiceService.createInvoice(body, params._userId);
    },
    {
        schema: createInvoiceSchema,
        permissions: [RBAC_PERMISSIONS.SOD_INVOICE]
    }
);

/**
 * PATCH: Update invoice key data and parameters
 */
export const PATCH = apiHandler(
    async (_request: Request, params, body: UpdateInvoiceDTO) => {
        return await InvoiceService.updateInvoice(body, params._userId);
    },
    {
        schema: updateInvoiceSchema,
        permissions: [RBAC_PERMISSIONS.SOD_INVOICE]
    }
);

/**
 * DELETE: Remove an invoice (only allowed in PENDING status)
 */
export const DELETE = apiHandler(
    async (request: Request, params) => {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');
        if (!id) {
            throw new AppError('Invoice ID required', ErrorCode.BAD_REQUEST, 400);
        }
        return await InvoiceService.deleteInvoice(id, params._userId);
    },
    {
        permissions: [RBAC_PERMISSIONS.SOD_INVOICE]
    }
);
