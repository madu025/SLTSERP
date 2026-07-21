import { apiHandler } from '@/lib/api-handler';
import { ProjectPermitService } from '@/services/project/project-permit.service';

export const dynamic = 'force-dynamic';

// GET all permit types with their authority
export const GET = apiHandler(async (request) => {
    const { searchParams } = new URL(request.url);
    const isActive = searchParams.get('isActive');
    const authorityId = searchParams.get('authorityId');

    const isActiveVal = isActive !== null ? isActive === 'true' : undefined;

    return await ProjectPermitService.getPermitTypes(isActiveVal, authorityId);
}, { rawResponse: true });
