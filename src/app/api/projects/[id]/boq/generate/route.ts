import { apiHandler } from '@/lib/api-handler';
import { AutoBOQService } from '@/services/project/auto-boq.service';
import { ROLE_GROUPS } from '@/config/roles';

export const dynamic = 'force-dynamic';

export const POST = apiHandler(async (_request, params) => {
    const { id: projectId } = params;

    const { boq, summary } = await AutoBOQService.generateBOQ(projectId);

    if (!boq.length) {
        return {
            message: 'No approved survey points found. Please ensure survey points are fully approved before generating BOQ.',
            boq: [],
            summary: {},
        };
    }

    return { boq, summary, count: boq.length };
}, {
    roles: ROLE_GROUPS.PROJECT_MANAGERS,
    audit: { action: 'PREVIEW_AUTO_BOQ', entity: 'PROJECT_BOQ' },
    rawResponse: true
});
