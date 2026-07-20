import { InventoryService } from '@/services/inventory.service';
import { createStockIssue } from '@/actions/inventory-actions';
import { apiHandler } from '@/lib/api-handler';
import { AppError } from '@/lib/error';

export const dynamic = 'force-dynamic';

export const POST = apiHandler(async (request, _params, body) => {
    try {
        const result = await createStockIssue(body);

        if (result.success) {
            return result.data;
        } else {
            throw AppError.badRequest(result.error);
        }
    } catch (error: any) {
        console.error("Error creating stock issue:", error);
        throw AppError.internal('Failed to create stock issue: ' + error.message);
    }
}, {
    audit: { action: 'CREATE', entity: 'STOCK_ISSUE' },
    rawResponse: true
});

export const GET = apiHandler(async (request) => {
    try {
        const { searchParams } = new URL(request.url);
        const storeId = searchParams.get('storeId') || undefined;
        const issueType = searchParams.get('issueType') || undefined;

        const issues = await InventoryService.getStockIssues({ storeId, issueType });
        return issues;
    } catch (error) {
        console.error("Error fetching stock issues:", error);
        throw AppError.internal("Failed to fetch stock issues");
    }
}, { rawResponse: true });
