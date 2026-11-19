import { z } from 'zod';
import { apiHandler } from '@/lib/api-handler';
import { AppError } from '@/lib/error';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { databaseUuidSchema } from '@/lib/validations/uuid.schema';
import { InvoicingService } from '@/services/invoice/invoicing.service';

export const dynamic = 'force-dynamic';

const bodySchema = z.discriminatedUnion('action', [
    z.object({ action: z.literal('CREATE'), month: z.number().int().min(1).max(12), year: z.number().int().min(2000).max(2200), sodIds: z.array(databaseUuidSchema).min(1).max(2000) }),
    z.object({ action: z.literal('HOLD'), sodIds: z.array(databaseUuidSchema).min(1).max(2000), reason: z.string().min(3).max(500) }),
    z.object({ action: z.literal('RELEASE'), sodIds: z.array(databaseUuidSchema).min(1).max(2000) }),
    z.object({ action: z.literal('RETURN'), sodIds: z.array(databaseUuidSchema).min(1).max(2000), reason: z.string().min(3).max(500) }),
]);

// GET /api/invoicing?month=&year=&rtom=&contractorId= - the orders passed by the Area Coordinator and QC Officer, grouped by contractor and area
export const GET = apiHandler(async (req, params) => {
    const sp = new URL(req.url).searchParams;
    return InvoicingService.candidates(params._userId ?? '', {
        month: Number(sp.get('month')), year: Number(sp.get('year')), rtom: sp.get('rtom') ?? undefined, contractorId: sp.get('contractorId') ?? undefined,
    });
}, { permissions: [RBAC_PERMISSIONS.SOD_INVOICE] });

// POST /api/invoicing - the engineer creates the invoices, holds orders back, releases them, or returns them to the Area Coordinator
export const POST = apiHandler(async (_req, params, body: z.infer<typeof bodySchema>) => {
    const userId = params._userId;
    if (!userId) throw AppError.unauthorized('Authentication required');
    switch (body.action) {
        case 'CREATE': return InvoicingService.create(userId, { month: body.month, year: body.year, sodIds: body.sodIds });
        case 'HOLD': return InvoicingService.hold(userId, body.sodIds, body.reason);
        case 'RELEASE': return InvoicingService.release(userId, body.sodIds);
        case 'RETURN': return InvoicingService.returnToCoordinator(userId, body.sodIds, body.reason);
    }
}, { schema: bodySchema, permissions: [RBAC_PERMISSIONS.SOD_INVOICE], audit: { action: 'ENGINEER_INVOICING', entity: 'ServiceOrder' } });
