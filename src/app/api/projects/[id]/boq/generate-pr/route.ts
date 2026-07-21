import { apiHandler } from '@/lib/api-handler';
import { ProjectBOQPRService } from '@/services/project/project-boq-pr.service';

export const dynamic = 'force-dynamic';

export const POST = apiHandler(async (request, params) => {
    const { id: projectId } = params;
    const userId = request.headers.get('x-user-id');
    
    // We expect userId to be provided by middleware or the apiHandler itself if we had req.user,
    // but sticking to the original route logic for reading headers:
    if (!userId) throw new Error('Unauthorized'); // or AppError.unauthorized

    const result = await ProjectBOQPRService.generatePR(projectId, userId);
    
    // Handle the case where no PR is generated but it's a valid 200 response
    if (result.action === 'view_existing') {
        return Response.json(result, { status: 200 });
    }
    
    if (result.message && !result.pr) {
        return Response.json(result, { status: 200 });
    }

    return Response.json(result, { status: 201 });
}, {
    audit: { action: 'CREATE', entity: 'PR' },
    rawResponse: true
});

export const GET = apiHandler(async (_request, params) => {
    const { id: projectId } = params;
    return await ProjectBOQPRService.getPRGenerationStatus(projectId);
}, { rawResponse: true });