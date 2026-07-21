import { apiHandler } from '@/lib/api-handler';
import { ProjectContractorRatingService } from '@/services/project/project-contractor-rating.service';
import { AppError } from '@/lib/error';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async (request, params) => {
    const { id: projectId } = await params;
    const { searchParams } = new URL(request.url);
    const evaluationMonth = searchParams.get('evaluationMonth');

    return await ProjectContractorRatingService.getRatings(projectId, evaluationMonth);
}, { rawResponse: true });

export const POST = apiHandler(async (_request, params, body) => {
    const { id: projectId } = await params;
    const { contractorId, evaluationMonth } = body || {};

    if (!contractorId || !evaluationMonth) {
        throw AppError.badRequest('contractorId and evaluationMonth are required');
    }

    return await ProjectContractorRatingService.saveRating({
        ...body,
        projectId
    });
}, {
    audit: { action: 'SAVE', entity: 'CONTRACTOR_RATING' },
    rawResponse: true
});
