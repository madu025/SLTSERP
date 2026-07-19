import { apiHandler } from '@/lib/api-handler';
import { NotificationAnalyticsService } from '@/services/notification/analytics.service';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async (request, context, { user }) => {
    // Only admins or super admins can view global analytics
    if (!['ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
        // Normal users get personal stats
        const personalStats = await NotificationAnalyticsService.getUserStats(user.id);
        return { data: personalStats };
    }

    const { searchParams } = new URL(request.url);
    const period = (searchParams.get('period') as any) || '30d';

    const analytics = await NotificationAnalyticsService.getAnalytics(period);
    return { data: analytics };
});
