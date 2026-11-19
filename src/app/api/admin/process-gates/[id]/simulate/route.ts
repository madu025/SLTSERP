export const dynamic = 'force-dynamic';
import { apiHandler } from '@/lib/api-handler';
import { AppError } from '@/lib/error';
import { z } from 'zod';
import { databaseUuidSchema } from '@/lib/validations/uuid.schema';
import { prisma } from '@/lib/prisma';
import { ProcessGateStatsService } from '@/services/admin/process-gate-stats.service';

const schema = z.object({ opmcId: databaseUuidSchema.optional().nullable(), contractorId: databaseUuidSchema.optional().nullable() });

// POST /api/admin/process-gates/[id]/simulate - a dry run: which steps would an item in this area / of this contractor go through, and who could act (read-only)
export const POST = apiHandler(async (_req, params, body) => {
    const id = params?.id as string;
    if (!id) throw AppError.badRequest('ID is required');
    return ProcessGateStatsService.simulate(id, { opmcId: body.opmcId ?? null, contractorId: body.contractorId ?? null });
}, { schema });

// GET - the areas and contractors a test can be run for
export const GET = apiHandler(async () => {
    const contractors = await prisma.contractor.findMany({
        where: { opmcId: { not: null }, status: { not: 'REJECTED' } },
        select: { id: true, name: true, opmcId: true, opmc: { select: { name: true, rtom: true } } },
        orderBy: { name: 'asc' },
    });
    const areas = new Map<string, string>();
    for (const c of contractors) if (c.opmcId && c.opmc) areas.set(c.opmcId, c.opmc.name || c.opmc.rtom);
    return {
        areas: [...areas.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name)),
        contractors: contractors.map((c) => ({ id: c.id, name: c.name, opmcId: c.opmcId })),
    };
});
