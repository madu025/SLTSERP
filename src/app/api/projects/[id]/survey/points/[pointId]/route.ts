import { apiHandler } from '@/lib/api-handler';
import { MapApprovalService } from '@/services/map-approval.service';
import { AppError } from '@/lib/error';

export const PATCH = apiHandler(async (request, params, body) => {
    const { pointId } = await params;
    const userId = request.headers.get('x-user-id');
    const { action, reason } = body || {};

    try {
        switch (action) {
            case 'verify':
                return await MapApprovalService.verifyPoint({ pointId, userId: userId! });
            case 'confirm':
                return await MapApprovalService.confirmPoint({ pointId, userId: userId! });
            case 'approve':
                return await MapApprovalService.approvePoint({ pointId, userId: userId! });
            case 'reject':
                return await MapApprovalService.rejectPoint({ pointId, userId: userId!, reason });
            case 'flag':
                return await MapApprovalService.flagPoint({ pointId, userId: userId!, reason });
            case 'update_coordinates': {
                const { latitude, longitude } = body;
                if (latitude == null || longitude == null) {
                    throw AppError.badRequest('latitude and longitude are required for update_coordinates');
                }
                const updated = await MapApprovalService.updatePointCoordinates(
                    pointId,
                    parseFloat(latitude),
                    parseFloat(longitude),
                    userId!
                );
                return {
                    success: true,
                    message: 'Coordinates updated successfully',
                    point: updated,
                };
            }
            default:
                throw AppError.badRequest('Invalid action. Use: verify, confirm, approve, reject, flag, update_coordinates');
        }
    } catch (error: unknown) {
        const err = error as { message?: string };
        if (err.message === 'SURVEY_POINT_NOT_FOUND') {
            throw AppError.notFound('Survey point not found');
        }
        throw error;
    }
}, {
    audit: { action: 'UPDATE', entity: 'SURVEY_POINT' },
    rawResponse: true
});