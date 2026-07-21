import { apiHandler } from '@/lib/api-handler';
import { ProjectSurveyService } from '@/services/project-survey.service';
import { AppError } from '@/lib/error';

export const POST = apiHandler(async (_request, params, body) => {
    const { id: projectId } = await params;

    try {
        const result = await ProjectSurveyService.completeSurveyAndGenerateBOQ(projectId, body);
        return result;
    } catch (error: unknown) {
        const err = error as { message?: string };
        if (err?.message === 'PROJECT_NOT_FOUND') {
            throw AppError.notFound('Project not found');
        }
        throw error;
    }
}, {
    audit: { action: 'SURVEY_COMPLETE', entity: 'Project' },
    rawResponse: true
});
