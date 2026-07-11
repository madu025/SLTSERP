import { apiHandler } from '@/lib/api-handler';
import { ProjectStockIssueService } from '@/services/project/project-stock-issue.service';
import { approveReturnSchema, ApproveReturnSchema } from '@/lib/validations/project-stock.schema';

/**
 * POST: Approve a pending material return request
 */
export const POST = apiHandler<{ success: boolean }, ApproveReturnSchema>(
    async (request: Request, params: unknown, body) => {
        const approvedById = request.headers.get('x-user-id');
        if (!approvedById) {
            throw new Error('Unauthorized');
        }

        const result = await ProjectStockIssueService.approveReturnRequest(body.returnId, approvedById);
        return result;
    },
    { schema: approveReturnSchema }
);
