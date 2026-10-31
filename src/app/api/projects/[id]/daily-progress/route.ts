import { z } from 'zod';
import { apiHandler } from '@/lib/api-handler';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { assertProjectAccess } from '@/lib/project-access';
import { ProjectProgressService } from '@/services/project/project-progress.service';

export const dynamic = 'force-dynamic';

const count = z.coerce.number().int().min(0).optional();
const money = z.coerce.number().min(0).optional();

const dailyProgressSchema = z.object({
    reportDate: z.coerce.date().optional(),
    polesErected: count,
    cablePulled: z.coerce.number().min(0).optional(),
    chambersInstalled: count,
    closuresInstalled: count,
    jointsCompleted: count,
    fdpsInstalled: count,
    teamSize: z.coerce.number().int().min(0).nullable().optional(),
    hoursWorked: z.coerce.number().min(0).nullable().optional(),
    laborCost: money,
    progressPct: z.coerce.number().min(0).max(100).optional(),
    notes: z.string().max(5000).nullable().optional(),
    photoUrls: z.array(z.string().max(2048)).max(50).optional(),
});

export const GET = apiHandler(async (_request, params) => {
    const { id: projectId } = await params;
    await assertProjectAccess(projectId, params._userId);
    return await ProjectProgressService.getDailyProgress(projectId);
}, { permissions: [RBAC_PERMISSIONS.PROJECT_READ], rawResponse: true });

export const POST = apiHandler(async (request, params, body) => {
    const { id: projectId } = await params;
    await assertProjectAccess(projectId, params._userId);
    const userId = request.headers.get('x-user-id');

    return await ProjectProgressService.createDailyProgress({
        reportDate: body.reportDate,
        polesErected: body.polesErected,
        cablePulled: body.cablePulled,
        chambersInstalled: body.chambersInstalled,
        closuresInstalled: body.closuresInstalled,
        jointsCompleted: body.jointsCompleted,
        fdpsInstalled: body.fdpsInstalled,
        teamSize: body.teamSize,
        hoursWorked: body.hoursWorked,
        laborCost: body.laborCost,
        progressPct: body.progressPct,
        notes: body.notes,
        photoUrls: body.photoUrls,
        projectId,
        reportedById: userId || undefined
    });
}, {
    schema: dailyProgressSchema,
    permissions: [RBAC_PERMISSIONS.PROJECT_WRITE],
    audit: { action: 'CREATE', entity: 'DAILY_PROGRESS' },
    rawResponse: true
});
