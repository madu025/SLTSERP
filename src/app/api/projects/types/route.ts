import { apiHandler } from '@/lib/api-handler';
import { ProjectTypeService } from '@/services/project-type.service';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async () => {
    return await ProjectTypeService.getProjectTypes();
}, { rawResponse: true });

export const POST = apiHandler(async (_request, _params, body) => {
    const { name, description } = body;
    return await ProjectTypeService.createProjectType(name, description);
}, {
    roles: ['ADMIN', 'SUPER_ADMIN'],
    audit: { action: 'PROJECT_TYPE_CREATE', entity: 'ProjectType' },
    rawResponse: true
});
