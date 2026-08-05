import { apiHandler } from '@/lib/api-handler';
import { UserService } from '@/services/hr/user.service';
import { AppError } from '@/lib/error';

export const dynamic = 'force-dynamic';

// POST /api/profile/change-password - Change user access password (rawResponse for compatibility)
export const POST = apiHandler(async (req, _params, body) => {
    const currentPassword = body.currentPassword as string | undefined;
    const newPassword = body.newPassword as string | undefined;
    const userId = req.headers.get('x-user-id');

    if (!userId || !currentPassword || !newPassword) {
        throw AppError.badRequest('All fields are required and user must be authenticated');
    }

    await UserService.changePassword(userId, currentPassword, newPassword);

    return {
        success: true,
        message: 'Password changed successfully'
    };
}, {
    roles: ['ALL'],
    audit: { action: 'UPDATE_PASSWORD', entity: 'USER_PROFILE' },
    rawResponse: true
});
