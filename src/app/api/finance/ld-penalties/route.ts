import { apiHandler } from "@/lib/api-handler";
import { LDPenaltyService } from "@/services/finance/ld-penalty.service";

export const dynamic = 'force-dynamic';

// GET /api/finance/ld-penalties - List all penalties
export const GET = apiHandler(async (req) => {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") || undefined;
    const projectId = searchParams.get("projectId") || undefined;

    return await LDPenaltyService.getPenalties({ status, projectId });
}, {
    rawResponse: true
});

// POST /api/finance/ld-penalties - Propose a new LD / Penalty
export const POST = apiHandler(async (req, _params, body) => {
    const { projectId, title, amount } = body;

    if (!projectId || !title || amount === undefined) {
        throw new Error("projectId, title, and amount are required fields");
    }

    return await LDPenaltyService.proposePenalty(body);
}, {
    roles: ['FINANCE_MANAGER', 'SUPER_ADMIN'],
    audit: { action: 'PROPOSE', entity: 'LD_PENALTY' },
    rawResponse: true
});

// PATCH /api/finance/ld-penalties - Approve or Waive a penalty (secure userId context)
export const PATCH = apiHandler(async (req, _params, body) => {
    const { id, status, waivedAmount, remarks } = body;
    const userId = req.headers.get("x-user-id");

    if (!id || !status || !userId) {
        throw new Error("id, status, and authenticated user are required fields");
    }

    return await LDPenaltyService.updatePenaltyStatus(id, status, userId, {
        waivedAmount: waivedAmount !== undefined ? Number(waivedAmount) : undefined,
        remarks
    });
}, {
    roles: ['FINANCE_MANAGER', 'SUPER_ADMIN'],
    audit: { action: 'UPDATE_STATUS', entity: 'LD_PENALTY' },
    rawResponse: true
});

// DELETE /api/finance/ld-penalties - Delete a proposed penalty
export const DELETE = apiHandler(async (req) => {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
        throw new Error("id is required");
    }

    return await LDPenaltyService.deletePenalty(id);
}, {
    roles: ['FINANCE_MANAGER', 'SUPER_ADMIN'],
    audit: { action: 'DELETE', entity: 'LD_PENALTY' },
    rawResponse: true
});
