import { apiHandler } from '@/lib/api-handler';
import { UserService } from '@/services/user.service';

export const dynamic = 'force-dynamic';

// POST /api/profile/change-password - Change user access password (rawResponse for compatibility)
export const POST = apiHandler(async (req, _params, body) => {
    const { currentPassword, newPassword } = body;
    const userId = req.headers.get('x-user-id');

    if (!userId || !currentPassword || !newPassword) {
        throw new Error('All fields are required and user must be authenticated');
    }

    await UserService.changePassword(userId, currentPassword, newPassword);

    return {
        success: true,
        message: 'Password changed successfully'
    };
}, {
    audit: { action: 'UPDATE_PASSWORD', entity: 'USER_PROFILE' },
    rawResponse: true
});
