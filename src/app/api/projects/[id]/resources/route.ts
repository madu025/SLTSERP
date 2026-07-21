import { apiHandler } from '@/lib/api-handler';
import { ProjectResourceService } from '@/services/project/project-resource.service';
import { AppError } from '@/lib/error';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async (_request, params) => {
    const { id: projectId } = params;
    return await ProjectResourceService.getResources(projectId);
}, { rawResponse: true });

export const POST = apiHandler(async (_request, params, body) => {
    const { id: projectId } = params;
    const { resourceType, resourceId, name, startDate, endDate } = body || {};

    if (!resourceType || !resourceId || !name || !startDate || !endDate) {
        throw AppError.badRequest('Missing required fields');
    }

    const result = await ProjectResourceService.allocateResource(
        projectId, 
        body as unknown as Parameters<typeof ProjectResourceService.allocateResource>[1]
    );
    return Response.json(result, { status: 201 });
}, {
    audit: { action: 'ALLOCATE_RESOURCE', entity: 'PROJECT_RESOURCE' },
    rawResponse: true
});

export const DELETE = apiHandler(async (request, _params) => {
    const { searchParams } = new URL(request.url);
    const resourceAllocationId = searchParams.get('id');

    if (!resourceAllocationId) {
        throw AppError.badRequest('Allocation ID is required');
    }

    return await ProjectResourceService.removeResource(resourceAllocationId);
}, {
    audit: { action: 'REMOVE_RESOURCE', entity: 'PROJECT_RESOURCE' },
    rawResponse: true
});
