import { StockIssue } from '@prisma/client';
import { apiHandler } from '@/lib/api-handler';
import { AppError } from '@/lib/error';
import { ProjectStockIssueService } from '@/services/project/project-stock-issue.service';
import { createStockIssueSchema, CreateStockIssueSchema } from '@/lib/validations/project-stock.schema';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { assertProjectAccess } from '@/lib/project-access';
import { StoreService } from '@/services/inventory/store.service';

export const dynamic = 'force-dynamic';

/**
 * POST: Create a pending stock issue request
 */
export const POST = apiHandler<StockIssue, CreateStockIssueSchema>(
    async (request: Request, params: unknown, body) => {
        const userId = request.headers.get('x-user-id');
        if (!userId) {
            throw AppError.unauthorized('Unauthorized');
        }
        await assertProjectAccess(body.projectId, userId);
        await StoreService.assertStoreWriteAccess(userId, body.storeId);

        const stockIssue = await ProjectStockIssueService.createIssueRequest({
            projectId: body.projectId,
            storeId: body.storeId,
            items: body.items,
            reservationId: body.reservationId,
            requirementId: body.requirementId,
            remarks: body.remarks,
            userId,
            issueDate: body.issueDate ? new Date(body.issueDate) : undefined
        });

        return stockIssue;
    },
    {
        schema: createStockIssueSchema,
        permissions: [RBAC_PERMISSIONS.INVENTORY_WRITE]
    }
);

/**
 * GET: Retrieve stock issues for a project
 */
export const GET = apiHandler<unknown[], void>(
    async (request: Request) => {
        const userId = request.headers.get('x-user-id');
        if (!userId) {
            throw AppError.unauthorized('Unauthorized');
        }

        const { searchParams } = new URL(request.url);
        const projectId = searchParams.get('projectId');

        if (!projectId) {
            throw AppError.badRequest('Project ID required');
        }
        await assertProjectAccess(projectId, userId);

        const issues = await ProjectStockIssueService.getProjectIssues(projectId);
        return issues;
    },
    { permissions: [RBAC_PERMISSIONS.PROJECT_READ] }
);
