export const dynamic = 'force-dynamic';

import { apiHandler } from '@/lib/api-handler';
import { prisma } from '@/lib/prisma';

/**
 * Public, read-only lookups for the contractor registration form (a team picks its OPMC). Only the id, name and RTOM
 * of the OPMC are exposed: no staff, stores or contractors.
 */
export const GET = apiHandler(async () => {
    const opmcs = await prisma.oPMC.findMany({
        select: { id: true, name: true, rtom: true },
        orderBy: { rtom: 'asc' },
    });
    return { opmcs };
}, { publicRoute: true, rawResponse: true });
