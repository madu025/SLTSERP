import { apiHandler } from '@/lib/api-handler';
import { AppError } from '@/lib/error';
import { prisma } from '@/lib/prisma';
import { resolveOpmcScope } from '@/lib/opmc-scope';
import { databaseUuidSchema } from '@/lib/validations/uuid.schema';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const complianceSchema = z.object({
    id: databaseUuidSchema,
    kycVerified: z.boolean().optional(),
    whtHoldStatus: z.boolean().optional(),
}).refine((data) => data.kycVerified !== undefined || data.whtHoldStatus !== undefined, {
    message: 'At least one compliance field is required',
});

export const PATCH = apiHandler(async (_request, params, body: z.infer<typeof complianceSchema>) => {
    const contractor = await prisma.contractor.findUnique({
        where: { id: body.id },
        select: { id: true, opmcId: true },
    });
    if (!contractor) throw AppError.notFound('Contractor not found');

    const scopedOpmcIds = await resolveOpmcScope(params._userId);
    if (scopedOpmcIds !== undefined && (!contractor.opmcId || !scopedOpmcIds.includes(contractor.opmcId))) {
        throw AppError.forbidden('Contractor is outside your OPMC scope');
    }

    return prisma.contractor.update({
        where: { id: body.id },
        data: {
            kycVerified: body.kycVerified,
            whtHoldStatus: body.whtHoldStatus,
        },
        select: {
            id: true,
            name: true,
            opmcId: true,
            kycVerified: true,
            whtHoldStatus: true,
        },
    });
}, {
    schema: complianceSchema,
    permissions: [RBAC_PERMISSIONS.CONTRACTOR_WRITE],
    audit: { action: 'UPDATE_COMPLIANCE', entity: 'CONTRACTOR' },
    rawResponse: true,
});
