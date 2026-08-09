import { ROLE_GROUPS } from '@/config/roles';
import { apiHandler } from '@/lib/api-handler';
import { AppError } from '@/lib/error';
import { ProjectTypeService } from '@/services/project/project-type.service';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async () => {
    return await ProjectTypeService.getProjectTypes();
}, { rawResponse: true });

export const POST = apiHandler(async (_request, _params, body) => {
    const name = body.name as string | undefined;
    const description = body.description as string | undefined;
    if (!name) throw AppError.badRequest('Name is required');
    return await ProjectTypeService.createProjectType(name, description);
}, {
    roles: ROLE_GROUPS.ADMINS,
    audit: { action: 'PROJECT_TYPE_CREATE', entity: 'ProjectType' },
    rawResponse: true
});
