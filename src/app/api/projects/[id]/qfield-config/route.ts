import { apiHandler } from '@/lib/api-handler';
import { ProjectQFieldConfigService } from '@/services/project/project-qfield-config.service';
import { AppError } from '@/lib/error';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async (_request, params) => {
    const { id: projectId } = await params;
    
    const configs = await ProjectQFieldConfigService.getConfigs(projectId);
    return { projectId, configs };
}, { rawResponse: true });

export const POST = apiHandler(async (_request, params, body) => {
    const { id: projectId } = await params;
    const { configs } = body || {};

    if (!Array.isArray(configs)) {
        throw AppError.badRequest('configs must be an array');
    }

    return await ProjectQFieldConfigService.updateConfigs(projectId, configs);
}, {
    audit: { action: 'UPDATE', entity: 'QFIELD_CONFIG' },
    rawResponse: true
});
