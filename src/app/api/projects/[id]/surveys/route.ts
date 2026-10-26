import { apiHandler } from '@/lib/api-handler';
import { ProjectSurveyService } from '@/services/project/project-survey.service';
import { AppError } from '@/lib/error';
import { ROLE_GROUPS } from '@/config/roles';

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
    const createdById = params._userId;

    if (!title || !surveyType || !createdById) {
        throw AppError.badRequest('title, surveyType, and authenticated session are required');
    }

    return await ProjectSurveyService.createSurveyRequest(params.id, {
        ...body,
        createdById,
    } as any);
}, {
    roles: ROLE_GROUPS.PROJECT_MANAGERS,
    audit: { action: 'CREATE_SURVEY_REQUEST', entity: 'ProjectSurvey' },
    rawResponse: true
});
