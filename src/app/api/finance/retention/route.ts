import { apiHandler } from "@/lib/api-handler";
import { RetentionService } from "@/services/finance/retention.service";

export const dynamic = 'force-dynamic';

// GET /api/finance/retention - List all project retentions (rawResponse for compatibility)
export const GET = apiHandler(async (req) => {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") || undefined;
    const projectId = searchParams.get("projectId") || undefined;

    return await RetentionService.getRetentions({ status, projectId });
}, {
    rawResponse: true
});

// POST /api/finance/retention - Release an amount from a project's retention balance
export const POST = apiHandler(async (req, _params, body) => {
    const { retentionId, releaseAmount, remarks } = body;
    const userId = req.headers.get("x-user-id") || undefined;

    if (!retentionId || releaseAmount === undefined) {
        throw new Error("retentionId and releaseAmount are required fields");
    }

    return await RetentionService.releaseRetention({
        retentionId,
        releaseAmount: Number(releaseAmount),
        approvedById: userId,
        remarks
    });
}, {
    roles: ['FINANCE_MANAGER', 'SUPER_ADMIN'],
    audit: { action: 'RELEASE', entity: 'PROJECT_RETENTION' },
    rawResponse: true
});
