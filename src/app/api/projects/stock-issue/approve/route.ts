import { apiHandler } from '@/lib/api-handler';
import { ProjectStockIssueService } from '@/services/project/project-stock-issue.service';
import { approveStockIssueSchema, ApproveStockIssueSchema } from '@/lib/validations/project-stock.schema';

/**
 * POST: Approve a pending stock issue request
 */
export const POST = apiHandler<{ success: boolean }, ApproveStockIssueSchema>(
    async (request: Request, params: unknown, body) => {
        const approvedById = request.headers.get('x-user-id');
        if (!approvedById) {
            throw new Error('Unauthorized');
        }

        const result = await ProjectStockIssueService.approveIssueRequest(body.issueId, approvedById);
        return result;
    },
    { schema: approveStockIssueSchema }
);
