import { getAuthenticatedUserId } from '@/lib/request-context';
import { apiHandler } from '@/lib/api-handler';
import { AppError } from '@/lib/error';
import { ProjectInvoiceService } from '@/services/project/project-invoice.service';

export const dynamic = 'force-dynamic';

/**
 * GET: Retrieve 3-level payment summary and financial analysis for a project
 */
export const GET = apiHandler<unknown, void>(
    async (request, params) => {
        const { id: projectId } = params;
        const userId = getAuthenticatedUserId();
        if (!userId) {
            throw AppError.unauthorized('Unauthorized');
        }

        const paymentSummary = await ProjectInvoiceService.getPaymentSummary(projectId);
        return paymentSummary;
    }
);