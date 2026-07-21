import { apiHandler } from '@/lib/api-handler';
import { ContractorService } from '@/services/contractor.service';
import { z } from 'zod';

const assignStoreSchema = z.object({
    storeId: z.string().min(1, "Store ID is required"),
    isPrimary: z.boolean().optional().default(false)
});

const removeStoreSchema = z.object({
    storeId: z.string().min(1, "Store ID is required")
});

export const GET = apiHandler(async (_req, params) => {
    const { teamId } = params;
    const team = await ContractorService.getTeamStores(teamId);
    return Response.json(team);
});

export const POST = apiHandler(async (_req, params, body) => {
    const { teamId } = params;
    const data = assignStoreSchema.parse(body);
    const assignment = await ContractorService.assignTeamStore(teamId, data.storeId, data.isPrimary);
    return Response.json(assignment);
}, {
    roles: ['STORES_MANAGER', 'STORES_ASSISTANT', 'SUPER_ADMIN', 'ADMIN'],
    audit: { action: 'ASSIGN_TEAM_STORE', entity: 'ContractorTeam' }
});

export const DELETE = apiHandler(async (_req, params, body) => {
    const { teamId } = params;
    const data = removeStoreSchema.parse(body);
    await ContractorService.removeTeamStore(teamId, data.storeId);
    return Response.json({ success: true });
}, {
    roles: ['STORES_MANAGER', 'STORES_ASSISTANT', 'SUPER_ADMIN', 'ADMIN'],
    audit: { action: 'REMOVE_TEAM_STORE', entity: 'ContractorTeam' }
});
