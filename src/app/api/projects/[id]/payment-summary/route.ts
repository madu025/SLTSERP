import { apiHandler } from '@/lib/api-handler';
import { ProjectInvoiceService } from '@/services/project/project-invoice.service';

export const dynamic = 'force-dynamic';

/**
 * GET: Retrieve 3-level payment summary and financial analysis for a project
 */
export const GET = apiHandler<unknown, void>(
    async (request: Request, params: { id: string }) => {
        const { id: projectId } = params;
        const userId = request.headers.get('x-user-id');
        if (!userId) {
            throw new Error('Unauthorized');
        }

        const paymentSummary = await ProjectInvoiceService.getPaymentSummary(projectId);
        return paymentSummary;
    }
);