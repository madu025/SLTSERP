import { apiHandler } from '@/lib/api-handler';
import { NotificationAnalyticsService } from '@/services/notification/analytics.service';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async (request, params) => {
    const userId = params._userId || '';

    // Only canonical global administration capability can view global
    // analytics. Other authenticated users receive their own statistics.
    if (!params._permissions.includes(RBAC_PERMISSIONS.ADMIN_RBAC)) {
        // Normal users get personal stats
        const personalStats = await NotificationAnalyticsService.getUserStats(userId);
        return { data: personalStats };
    }

    const { searchParams } = new URL(request.url);
    const period = (searchParams.get('period') as any) || '30d';

    const analytics = await NotificationAnalyticsService.getAnalytics(period);
    return { data: analytics };
});
