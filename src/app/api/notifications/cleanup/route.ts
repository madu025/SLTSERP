import { apiHandler } from '@/lib/api-handler';
import { NotificationService } from '@/services/notification.service';
import { AppError } from '@/lib/error';

export const POST = apiHandler(async (req) => {
    const authHeader = req.headers.get('authorization');
    const internalSecret = process.env.CRON_SECRET;

    if (internalSecret && authHeader !== `Bearer ${internalSecret}`) {
        throw AppError.unauthorized('Unauthorized: Invalid CRON_SECRET');
    }

    const result = await NotificationService.cleanup();

    return Response.json({
        message: 'Notification cleanup completed successfully',
        deletedCount: result.count,
        timestamp: new Date().toISOString()
    });
});

export const GET = apiHandler(async (req) => {
    const authHeader = req.headers.get('authorization');
    const internalSecret = process.env.CRON_SECRET;

    if (internalSecret && authHeader !== `Bearer ${internalSecret}`) {
        throw AppError.unauthorized('Unauthorized: Invalid CRON_SECRET');
    }

    const result = await NotificationService.cleanup();

    return Response.json({
        message: 'Notification cleanup completed successfully',
        deletedCount: result.count,
        timestamp: new Date().toISOString()
    });
});
