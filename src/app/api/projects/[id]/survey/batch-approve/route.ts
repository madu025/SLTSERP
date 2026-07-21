import { apiHandler } from '@/lib/api-handler';
import { MapApprovalService } from '@/services/map-approval.service';
import { AppError } from '@/lib/error';

export const dynamic = 'force-dynamic';

export const POST = apiHandler(async (request, _params, body) => {
    const userId = request.headers.get('x-user-id');
    if (!userId) {
        throw AppError.unauthorized('Unauthorized');
    }

    const { pointIds, action } = body || {};

    if (!pointIds || !Array.isArray(pointIds) || pointIds.length === 0) {
        throw AppError.badRequest('pointIds array is required');
    }

    if (!action || !['verify', 'approve'].includes(action)) {
        throw AppError.badRequest('action must be "verify" or "approve"');
    }

    let result: { succeeded: number; failed: number; total: number };
    const pointIdsArray = pointIds as string[];

    if (action === 'verify') {
        result = await MapApprovalService.batchVerify(pointIdsArray, userId);
    } else {
        result = await MapApprovalService.batchApprove(pointIdsArray, userId);
    }

    return {
        message: `Batch ${action} completed: ${result.succeeded}/${result.total} succeeded`,
        ...result,
    };
}, {
    audit: { action: 'BATCH_APPROVE_SURVEY', entity: 'PROJECT_SURVEY' },
    rawResponse: true
});