import { apiHandler } from '@/lib/api-handler';
import { ProjectOTDRService } from '@/services/project/project-otdr.service';
import { AppError } from '@/lib/error';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async (_request, params) => {
    const { id: projectId } = params;
    return await ProjectOTDRService.getOTDRTests(projectId);
}, { rawResponse: true });

export const POST = apiHandler(async (_request, params, body) => {
    const { id: projectId } = params;
    
    if (!body || !body.testedById) {
        throw AppError.badRequest('testedById is required');
    }

    const otdrTest = await ProjectOTDRService.createOTDRTest(
        projectId, 
        body as unknown as Parameters<typeof ProjectOTDRService.createOTDRTest>[1]
    );
    return Response.json(otdrTest, { status: 201 });
}, {
    audit: { action: 'CREATE', entity: 'PROJECT_OTDR' },
    rawResponse: true
});
