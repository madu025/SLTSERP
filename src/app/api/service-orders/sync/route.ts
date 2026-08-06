export const dynamic = 'force-dynamic';
import { z } from 'zod';
import { apiHandler } from '@/lib/api-handler';
import { ServiceOrderService } from '@/services/service-order/sod.service';
import { AppError } from '@/lib/error';
import { ROLE_GROUPS } from '@/config/roles';
import { resolveOpmcScope, NIL_UUID } from '@/lib/opmc-scope';
import { prisma } from '@/lib/prisma';
import { isValidUuid } from '@/lib/uuid';

const syncSODSchema = z.object({
    rtomId: z.string().optional(),
    opmcId: z.string().optional(),
    rtom: z.string().optional(),
}).refine((data) => Boolean(data.rtomId || data.opmcId || data.rtom), {
    message: 'RTOM selection or OPMC ID is required for sync'
});

export const POST = apiHandler<unknown, z.infer<typeof syncSODSchema>>(async (_request, params, body) => {
    const targetId = body.rtomId || body.opmcId;
    const rtom = body.rtom || '';

    if (!targetId) {
        throw AppError.badRequest('RTOM selection or OPMC ID is required for sync');
    }

    // Regional ownership check: non-admin users may only sync OPMCs inside
    // their accessible scope (admins unrestricted). targetId may be a UUID
    // or an RTOM code — resolve the OPMC first, then verify membership.
    const scope = await resolveOpmcScope(params._userId);
    if (scope !== undefined) {
        const opmc = await prisma.oPMC.findFirst({
            where: {
                OR: [
                    { id: isValidUuid(targetId) ? targetId : NIL_UUID },
                    { rtom: { equals: targetId, mode: 'insensitive' } }
                ]
            },
            select: { id: true }
        });
        if (!opmc || !scope.includes(opmc.id)) {
            throw AppError.forbidden('Target OPMC is outside your regional access');
        }
    }

    try {
        const result = await ServiceOrderService.syncServiceOrders(targetId, rtom);
        return result;
    } catch (error: unknown) {
        const errMessage = error instanceof Error ? error.message : (error as { message?: string })?.message;
        if (errMessage === 'RTOM_AND_ID_REQUIRED') {
            throw AppError.badRequest('RTOM selection is required');
        }
        throw error;
    }
}, {
    schema: syncSODSchema,
    roles: ROLE_GROUPS.INVOICE_GENERATORS,
    audit: { action: 'SYNC_SERVICE_ORDERS', entity: 'ServiceOrder' },
    rawResponse: true
});


