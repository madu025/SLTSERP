import { apiHandler } from '@/lib/api-handler';
import { ProjectSurveyService } from '@/services/project/project-survey.service';
import { AppError } from '@/lib/error';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { z } from 'zod';

const createSurveyRequestSchema = z.object({
    title: z.string().min(1), surveyType: z.string().min(1), description: z.string().optional(),
    priority: z.string().optional(), assignedTeamId: z.string().optional(), assignedToId: z.string().optional(),
    scheduledDate: z.string().optional(), estimatedBOQ: z.union([z.string(), z.number()]).optional(),
});

export const dynamic = 'force-dynamic';

// GET: List survey requests with checkins, photos, findings count
export const GET = apiHandler(async (request, params) => {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || undefined;
    const surveyType = searchParams.get('surveyType') || undefined;

    return await ProjectSurveyService.getSurveyRequests(params.id, { status, surveyType });
}, { permissions: [RBAC_PERMISSIONS.PROJECT_READ], rawResponse: true });

// POST: Create survey request
export const POST = apiHandler(async (_request, params, body) => {
    const data = createSurveyRequestSchema.parse(body);
    const createdById = params._userId;

    if (!createdById) throw AppError.unauthorized('Authentication required');

    return await ProjectSurveyService.createSurveyRequest(params.id, {
        ...data,
        createdById,
    });
}, {
    permissions: [RBAC_PERMISSIONS.PROJECT_WRITE],
    audit: { action: 'CREATE_SURVEY_REQUEST', entity: 'ProjectSurvey' },
    rawResponse: true
});
