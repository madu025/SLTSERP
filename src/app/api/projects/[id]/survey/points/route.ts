import { apiHandler } from '@/lib/api-handler';
import { MapApprovalService } from '@/services/map-approval.service';
import { ProjectSurveyService } from '@/services/project/project-survey.service';
import { AppError } from '@/lib/error';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async (request, params) => {
    const { id: projectId } = params;
    const { searchParams } = new URL(request.url);
    const layerId = searchParams.get('layerId') ?? undefined;
    const status = searchParams.get('status') ?? undefined;
    const page = parseInt(searchParams.get('page') ?? '1');
    const limit = parseInt(searchParams.get('limit') ?? '50');

    return await MapApprovalService.getSurveyPoints(projectId, { layerId, status, page, limit });
}, { rawResponse: true });

export const POST = apiHandler(async (request, params, body) => {
    const { id: projectId } = params;
    const userId = request.headers.get('x-user-id');

    if (!userId) {
        throw AppError.unauthorized('Unauthorized');
    }

    const { sessionId, layerId, layerName, latitude, longitude, attributes, photoUrls } = body || {};
    
    if (!sessionId || !layerId || !latitude || !longitude) {
        throw AppError.badRequest('Missing required fields: sessionId, layerId, latitude, longitude');
    }

    const point = await ProjectSurveyService.createSurveyPoint({
        projectId,
        sessionId: sessionId as string,
        layerId: layerId as string,
        layerName: layerName as string | undefined,
        latitude: latitude as number,
        longitude: longitude as number,
        attributes: attributes as Record<string, unknown> | undefined,
        photoUrls: photoUrls as string[] | undefined,
        supervisorId: userId,
    });

    return Response.json(point, { status: 201 });
}, {
    audit: { action: 'CREATE', entity: 'PROJECT_SURVEY_POINT' },
    rawResponse: true
});
