export const dynamic = 'force-dynamic';
import { DynamicReportService, DynamicReportPayload } from '@/services/inventory/dynamic-report.service';
import { apiHandler, castBody } from '@/lib/api-handler';
import { AppError } from '@/lib/error';

export const POST = apiHandler(async (_request, _params, body) => {
    try {
        const report = await DynamicReportService.generateReport(castBody<DynamicReportPayload>(body));
        return { success: true, data: report };
    } catch (error: unknown) {
        throw AppError.badRequest(error instanceof Error ? error.message : 'Failed to generate report');
    }
}, { rawResponse: true });
