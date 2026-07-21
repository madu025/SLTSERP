import { apiHandler } from '@/lib/api-handler';
import { ReportService } from '@/services/report.service';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async (request) => {
    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get('date');

    return await ReportService.getDailyOperationalReport({ date: dateParam });
}, { rawResponse: true });
