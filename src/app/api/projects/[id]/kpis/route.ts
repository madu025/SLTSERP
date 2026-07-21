import { apiHandler } from '@/lib/api-handler';
import { ProjectKPIService } from '@/services/project/project-kpi.service';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async (_request, params) => {
    const { id: projectId } = params;
    return await ProjectKPIService.getKPIAnalytics(projectId);
}, { rawResponse: true });