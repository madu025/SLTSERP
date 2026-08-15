export const dynamic = 'force-dynamic';
import { DynamicReportService, DynamicReportPayload } from '@/services/inventory/dynamic-report.service';
import { apiHandler, castBody } from '@/lib/api-handler';
export const POST = apiHandler(async (_request, _params, body) => {
    const report = await DynamicReportService.generateReport(castBody<DynamicReportPayload>(body));
    return { success: true, data: report };
}, { rawResponse: true });