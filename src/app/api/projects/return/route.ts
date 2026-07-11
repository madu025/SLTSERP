import { ProjectMaterialReturn } from '@prisma/client';
import { apiHandler } from '@/lib/api-handler';
import { ProjectStockIssueService } from '@/services/project/project-stock-issue.service';
import { createReturnSchema, CreateReturnSchema } from '@/lib/validations/project-stock.schema';

export const dynamic = 'force-dynamic';

/**
 * POST: Create a return request
 */
export const POST = apiHandler<ProjectMaterialReturn, CreateReturnSchema>(
    async (request: Request, params: unknown, body) => {
        const userId = request.headers.get('x-user-id');
        if (!userId) {
            throw new Error('Unauthorized');
        }

        const returnReq = await ProjectStockIssueService.createReturnRequest({
            projectId: body.projectId,
            storeId: body.storeId,
            items: body.items,
            reason: body.reason,
            userId
        });

        return returnReq;
    },
    { schema: createReturnSchema }
);

/**
 * GET: Retrieve returns for a project
 */
export const GET = apiHandler<unknown[], void>(
    async (request: Request) => {
        const userId = request.headers.get('x-user-id');
        if (!userId) {
            throw new Error('Unauthorized');
        }

        const { searchParams } = new URL(request.url);
        const projectId = searchParams.get('projectId');

        if (!projectId) {
            throw new Error('Project ID required');
        }

        const returns = await ProjectStockIssueService.getProjectReturns(projectId);
        return returns;
    }
);
