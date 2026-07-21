import { apiHandler } from '@/lib/api-handler';
import { ReportService } from '@/services/report.service';
import { AppError } from '@/lib/error';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async (request) => {
    const { searchParams } = new URL(request.url);
    const view = searchParams.get('view') || 'manager';
    const period = searchParams.get('period') || '6M';
    const customFrom = searchParams.get('from');
    const customTo = searchParams.get('to');
    const groupBy = searchParams.get('groupBy') || 'RTOM';

    if (view !== 'manager' && view !== 'area') {
        throw AppError.badRequest('Invalid view type');
    }

    return await ReportService.getAnalyticsReport(view, period, {
        customFrom,
        customTo,
        groupBy
    });
}, { rawResponse: true });
