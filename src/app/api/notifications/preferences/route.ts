import { apiHandler } from '@/lib/api-handler';
import { NotificationService } from '@/services/notification.service';
import { AppError } from '@/lib/error';
import { z } from 'zod';

const preferenceSchema = z.object({
    type: z.string().min(1, 'Type is required'),
    enabled: z.boolean()
});

export const GET = apiHandler(async (req) => {
    const userId = req.headers.get('x-user-id');

    if (!userId) {
        throw AppError.unauthorized('Unauthorized');
    }

    const preferences = await NotificationService.getUserPreferences(userId);
    return Response.json(preferences);
});

export const POST = apiHandler(async (req, _params, body) => {
    const userId = req.headers.get('x-user-id');

    if (!userId) {
        throw AppError.unauthorized('Unauthorized');
    }

    const { type, enabled } = preferenceSchema.parse(body);

    const preference = await NotificationService.upsertUserPreference(userId, type, enabled);
    return Response.json(preference);
}, {
    audit: { action: 'UPDATE_NOTIFICATION_PREFERENCE', entity: 'User' }
});
