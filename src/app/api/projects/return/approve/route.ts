export const dynamic = 'force-dynamic';
import { apiHandler } from '@/lib/api-handler';
import { ProjectStockIssueService } from '@/services/project/project-stock-issue.service';
import { approveReturnSchema, ApproveReturnSchema } from '@/lib/validations/project-stock.schema';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { prisma } from '@/lib/prisma';
import { assertProjectAccess } from '@/lib/project-access';
import { AppError } from '@/lib/error';

/**
 * POST: Approve a pending material return request
 */
export const POST = apiHandler<{ success: boolean }, ApproveReturnSchema>(
    async (request: Request, params: unknown, body) => {
        const approvedById = request.headers.get('x-user-id');
        if (!approvedById) {
            throw AppError.unauthorized('Unauthorized');
        }

        const ret = await prisma.projectMaterialReturn.findUnique({ where: { id: body.returnId }, select: { projectId: true } });
        if (!ret) throw AppError.notFound('Return request not found');
        await assertProjectAccess(ret.projectId, approvedById);

        const result = await ProjectStockIssueService.approveReturnRequest(body.returnId, approvedById);
        return result;
    },
    { schema: approveReturnSchema, permissions: [RBAC_PERMISSIONS.INVENTORY_APPROVE] }
);
