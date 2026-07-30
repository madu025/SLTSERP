import { apiHandler } from '@/lib/api-handler';
import { ProjectSurveyService } from '@/services/project/project-survey.service';
import { AppError } from '@/lib/error';

export const dynamic = 'force-dynamic';

// GET: List survey requests with checkins, photos, findings count
export const GET = apiHandler(async (request, params) => {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || undefined;
    const surveyType = searchParams.get('surveyType') || undefined;

    return await ProjectSurveyService.getSurveyRequests(params.id, { status, surveyType });
}, { rawResponse: true });

// POST: Create survey request
export const POST = apiHandler(async (_request, params, body) => {
    const title = body.title as string | undefined;
    const surveyType = body.surveyType as string | undefined;
    const createdById = body.createdById as string | undefined;

    if (!title || !surveyType || !createdById) {
        throw AppError.badRequest('title, surveyType, and createdById are required');
    }

    return await ProjectSurveyService.createSurveyRequest(params.id, body as any);
}, {
    audit: { action: 'CREATE_SURVEY_REQUEST', entity: 'ProjectSurvey' },
    rawResponse: true
});
