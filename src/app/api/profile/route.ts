import { apiHandler } from '@/lib/api-handler';
import { UserService } from '@/services/user.service';

export const dynamic = 'force-dynamic';

// GET /api/profile - Fetch authenticated user profile details (rawResponse for compatibility)
export const GET = apiHandler(async (req) => {
    const userId = req.headers.get('x-user-id');
    if (!userId) {
        throw new Error('Unauthorized');
    }

    return await UserService.getProfile(userId);
}, {
    rawResponse: true
});

// PATCH /api/profile - Update user profile details (rawResponse for compatibility)
export const PATCH = apiHandler(async (req, _params, body) => {
    const { name, email } = body;
    const userId = req.headers.get('x-user-id');

    if (!userId) {
        throw new Error('Unauthorized');
    }

    return await UserService.updateProfile(userId, { name, email });
}, {
    audit: { action: 'UPDATE_PROFILE', entity: 'USER_PROFILE' },
    rawResponse: true
});
