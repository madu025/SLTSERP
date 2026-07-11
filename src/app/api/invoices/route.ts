import { apiHandler } from '@/lib/api-handler';
import { InvoiceService } from '@/services/invoice.service';
import { createInvoiceSchema, updateInvoiceSchema, CreateInvoiceDTO, UpdateInvoiceDTO } from '@/lib/validations/invoice.schema';
import { AppError, ErrorCode } from '@/lib/error';

export const dynamic = 'force-dynamic';

/**
 * GET: Fetch all invoices with filters
 */
export const GET = apiHandler(async (request: Request) => {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || undefined;
    const contractorId = searchParams.get('contractorId') || undefined;
    const projectId = searchParams.get('projectId') || undefined;

    return await InvoiceService.getInvoices({ status, contractorId, projectId });
});

/**
 * POST: Create a new invoice
 */
export const POST = apiHandler(
    async (_request: Request, _params: unknown, body: CreateInvoiceDTO) => {
        return await InvoiceService.createInvoice(body);
    },
    {
        schema: createInvoiceSchema,
        roles: ['ADMIN', 'SUPER_ADMIN', 'MANAGER', 'OSP_MANAGER']
    }
);

/**
 * PATCH: Update invoice key data and parameters
 */
export const PATCH = apiHandler(
    async (_request: Request, _params: unknown, body: UpdateInvoiceDTO) => {
        return await InvoiceService.updateInvoice(body);
    },
    {
        schema: updateInvoiceSchema,
        roles: ['ADMIN', 'SUPER_ADMIN', 'MANAGER', 'OSP_MANAGER']
    }
);

/**
 * DELETE: Remove an invoice (only allowed in PENDING status)
 */
export const DELETE = apiHandler(
    async (request: Request) => {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');
        if (!id) {
            throw new AppError('Invoice ID required', ErrorCode.BAD_REQUEST, 400);
        }
        return await InvoiceService.deleteInvoice(id);
    },
    {
        roles: ['ADMIN', 'SUPER_ADMIN', 'MANAGER', 'OSP_MANAGER']
    }
);
