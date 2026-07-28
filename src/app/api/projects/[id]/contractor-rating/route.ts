import { apiHandler } from '@/lib/api-handler';
import { ProjectContractorRatingService } from '@/services/project/project-contractor-rating.service';
import { AppError } from '@/lib/error';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async (request, params) => {
    const { searchParams } = new URL(request.url);
    const evaluationMonth = searchParams.get('evaluationMonth');

    return await ProjectContractorRatingService.getRatings(params.id, evaluationMonth);
}, { rawResponse: true });

export const POST = apiHandler(async (_request, params, body) => {
    const contractorId = body.contractorId as string | undefined;
    const evaluationMonth = body.evaluationMonth as string | undefined;

    if (!contractorId || !evaluationMonth) {
        throw AppError.badRequest('contractorId and evaluationMonth are required');
    }

    return await ProjectContractorRatingService.saveRating({
        ...(body as unknown as Parameters<typeof ProjectContractorRatingService.saveRating>[0]),
        projectId: params.id
    });
}, {
    audit: { action: 'SAVE', entity: 'CONTRACTOR_RATING' },
    rawResponse: true
});
