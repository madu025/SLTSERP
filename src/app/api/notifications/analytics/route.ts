import { apiHandler } from '@/lib/api-handler';
import { NotificationAnalyticsService } from '@/services/notification/analytics.service';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async (request, params) => {
    const role = params._userRole || request.headers.get('x-user-role') || '';
    const userId = params._userId || request.headers.get('x-user-id') || '';

    // Only admins or super admins can view global analytics
    if (!['ADMIN', 'SUPER_ADMIN'].includes(role)) {
        // Normal users get personal stats
        const personalStats = await NotificationAnalyticsService.getUserStats(userId);
        return { data: personalStats };
    }

    const { searchParams } = new URL(request.url);
    const period = (searchParams.get('period') as any) || '30d';

    const analytics = await NotificationAnalyticsService.getAnalytics(period);
    return { data: analytics };
});
