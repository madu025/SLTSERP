import { apiHandler } from '@/lib/api-handler';
import { ProjectSurveyService } from '@/services/project-survey.service';
import { AppError } from '@/lib/error';

export const dynamic = 'force-dynamic';

// GET: List survey requests with checkins, photos, findings count
export const GET = apiHandler(async (request, params) => {
    const { id: projectId } = await params;
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || undefined;
    const surveyType = searchParams.get('surveyType') || undefined;

    return await ProjectSurveyService.getSurveyRequests(projectId, { status, surveyType });
}, { rawResponse: true });

// POST: Create survey request
export const POST = apiHandler(async (_request, params, body) => {
    const { id: projectId } = await params;
    const { title, surveyType, createdById } = body || {};

    if (!title || !surveyType || !createdById) {
        throw AppError.badRequest('title, surveyType, and createdById are required');
    }

    return await ProjectSurveyService.createSurveyRequest(projectId, body);
}, {
    audit: { action: 'CREATE_SURVEY_REQUEST', entity: 'ProjectSurvey' },
    rawResponse: true
});
