import { ROLE_GROUPS } from '@/config/roles';
import { apiHandler } from "@/lib/api-handler";
import { LDPenaltyService } from "@/services/finance/ld-penalty.service";
import { z } from 'zod';


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

const proposePenaltySchema = z.object({
    projectId: z.string(),
    title: z.string(),
    description: z.string().nullish(),
    type: z.string().optional(),
    category: z.string().optional(),
    amount: z.number(),
    percentage: z.number().nullish(),
    referenceTable: z.string().nullish(),
    referenceId: z.string().nullish(),
    referenceDesc: z.string().nullish(),
    remarks: z.string().nullish(),
    leviedById: z.string().nullish(),
});

const updatePenaltyStatusSchema = z.object({
    id: z.string(),
    status: z.enum(['APPROVED', 'WAIVED', 'COLLECTED']),
    waivedAmount: z.number().optional(),
    remarks: z.string().optional(),
});

// POST /api/finance/ld-penalties - Propose a new LD / Penalty
export const POST = apiHandler(async (_req, _params, body) => {
    return await LDPenaltyService.proposePenalty(body);
}, {
    schema: proposePenaltySchema,
    roles: ROLE_GROUPS.FINANCE_APPROVERS,
    audit: { action: 'PROPOSE', entity: 'LD_PENALTY' },
    rawResponse: true
});

// PATCH /api/finance/ld-penalties - Approve or Waive a penalty
export const PATCH = apiHandler(async (req, _params, body) => {
    const { id, status, waivedAmount, remarks } = body;
    const userId = req.headers.get("x-user-id");

    if (!userId) throw new Error('Authenticated user is required');

    return await LDPenaltyService.updatePenaltyStatus(id, status, userId, {
        waivedAmount,
        remarks: remarks ?? undefined,
    });
}, {
    schema: updatePenaltyStatusSchema,
    roles: ROLE_GROUPS.FINANCE_APPROVERS,
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
    roles: ROLE_GROUPS.FINANCE_APPROVERS,
    audit: { action: 'DELETE', entity: 'LD_PENALTY' },
    rawResponse: true
});
