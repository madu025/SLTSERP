import { StockIssue } from '@prisma/client';
import { apiHandler } from '@/lib/api-handler';
import { ProjectStockIssueService } from '@/services/project/project-stock-issue.service';
import { createStockIssueSchema, CreateStockIssueSchema } from '@/lib/validations/project-stock.schema';

export const dynamic = 'force-dynamic';

/**
 * POST: Create a pending stock issue request
 */
export const POST = apiHandler<StockIssue, CreateStockIssueSchema>(
    async (request: Request, params: unknown, body) => {
        const userId = request.headers.get('x-user-id');
        if (!userId) {
            throw new Error('Unauthorized');
        }

        const stockIssue = await ProjectStockIssueService.createIssueRequest({
            projectId: body.projectId,
            storeId: body.storeId,
            items: body.items,
            remarks: body.remarks,
            userId,
            issueDate: body.issueDate ? new Date(body.issueDate) : undefined
        });

        return stockIssue;
    },
    { schema: createStockIssueSchema }
);

/**
 * GET: Retrieve stock issues for a project
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

        const issues = await ProjectStockIssueService.getProjectIssues(projectId);
        return issues;
    }
);
