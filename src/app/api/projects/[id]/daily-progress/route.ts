import { apiHandler } from '@/lib/api-handler';
import { ProjectProgressService } from '@/services/project/project-progress.service';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async (_request, params) => {
    const { id: projectId } = await params;
    return await ProjectProgressService.getDailyProgress(projectId);
}, { rawResponse: true });

export const POST = apiHandler(async (request, params, body) => {
    const { id: projectId } = await params;
    const userId = request.headers.get('x-user-id');

    return await ProjectProgressService.createDailyProgress({
        ...body,
        projectId,
        reportedById: userId || undefined
    });
}, {
    audit: { action: 'CREATE', entity: 'DAILY_PROGRESS' },
    rawResponse: true
});
