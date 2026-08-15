import { apiHandler } from '@/lib/api-handler';
import { ReportService } from '@/services/core/report.service';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const querySchema = z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
});

export const GET = apiHandler(async (request) => {
    const { searchParams } = new URL(request.url);
    const parsed = querySchema.safeParse({
        date: searchParams.get('date'),
    });

    if (!parsed.success) {
        return { success: false, error: 'Invalid query parameters', details: parsed.error.format() };
    }

    return await ReportService.getDailyOperationalReport({ date: parsed.data.date });
}, { rawResponse: true, menuPath: '/reports/daily-operational' });
