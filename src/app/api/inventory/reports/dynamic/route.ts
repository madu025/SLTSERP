import { DynamicReportService } from '@/services/inventory/dynamic-report.service';
import { apiHandler } from '@/lib/api-handler';
import { AppError } from '@/lib/error';

export const POST = apiHandler(async (request, _params, body) => {
    try {
        const report = await DynamicReportService.generateReport(body);
        return { success: true, data: report };
    } catch (error: any) {
        throw AppError.badRequest(error.message || 'Failed to generate report');
    }
}, { rawResponse: true });
