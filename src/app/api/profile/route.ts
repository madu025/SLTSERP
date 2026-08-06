import { apiHandler } from '@/lib/api-handler';
import { UserService } from '@/services/hr/user.service';
import { AppError } from '@/lib/error';

export const dynamic = 'force-dynamic';

// GET /api/profile - Fetch authenticated user profile details (rawResponse for compatibility)
export const GET = apiHandler(async (req) => {
    const userId = req.headers.get('x-user-id');
    if (!userId) {
        throw AppError.unauthorized('Unauthorized');
    }

    return await UserService.getProfile(userId);
}, {
    rawResponse: true
});

// PATCH /api/profile - Update user profile details (rawResponse for compatibility)
export const PATCH = apiHandler(async (req, _params, body) => {
    const name = body.name as string | undefined;
    const email = body.email as string | undefined;
    const userId = req.headers.get('x-user-id');

    if (!userId) {
        throw AppError.unauthorized('Unauthorized');
    }

    return await UserService.updateProfile(userId, { name, email });
}, {
    roles: ['ALL'],
    audit: { action: 'UPDATE_PROFILE', entity: 'USER_PROFILE' },
    rawResponse: true
});
