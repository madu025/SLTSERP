import { ProjectMaterialReturn } from '@prisma/client';
import { apiHandler } from '@/lib/api-handler';
import { AppError } from '@/lib/error';
import { ProjectStockIssueService } from '@/services/project/project-stock-issue.service';
import { createReturnSchema, CreateReturnSchema } from '@/lib/validations/project-stock.schema';
import { ROLE_GROUPS } from '@/config/roles';
import { assertProjectAccess } from '@/lib/project-access';

export const dynamic = 'force-dynamic';

/**
 * POST: Create a return request
 */
export const POST = apiHandler<ProjectMaterialReturn, CreateReturnSchema>(
    async (request: Request, params: unknown, body) => {
        const userId = request.headers.get('x-user-id');
        if (!userId) {
            throw AppError.unauthorized('Unauthorized');
        }
        await assertProjectAccess(body.projectId, userId);

        const returnReq = await ProjectStockIssueService.createReturnRequest({
            projectId: body.projectId,
            storeId: body.storeId,
            issueId: body.issueId,
            items: body.items,
            reason: body.reason,
            userId
        });

        return returnReq;
    },
    { schema: createReturnSchema, roles: [...ROLE_GROUPS.STORES_ALL, ...ROLE_GROUPS.PROJECT_MANAGERS] }
);

/**
 * GET: Retrieve returns for a project
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
        const returns = await ProjectStockIssueService.getProjectReturns(projectId);
        return returns;
    }
);
