export const dynamic = 'force-dynamic';
import { apiHandler } from '@/lib/api-handler';
import { ProjectStockIssueService } from '@/services/project/project-stock-issue.service';
import { approveStockIssueSchema, ApproveStockIssueSchema } from '@/lib/validations/project-stock.schema';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { AppError } from '@/lib/error';

/**
 * POST: Approve a pending stock issue request
 */
export const POST = apiHandler<{ success: boolean }, ApproveStockIssueSchema>(
    async (request: Request, params: unknown, body) => {
        const approvedById = request.headers.get('x-user-id');
        if (!approvedById) {
            throw AppError.unauthorized('Unauthorized');
        }

        const result = await ProjectStockIssueService.approveIssueRequest(body.issueId, approvedById);
        return result;
    },
    { schema: approveStockIssueSchema, permissions: [RBAC_PERMISSIONS.INVENTORY_APPROVE] }
);
