import { apiHandler } from '@/lib/api-handler';
import { ContractorService } from '@/services/contractor.service';
import { z } from 'zod';

const saveTeamsSchema = z.object({
    teams: z.array(z.object({
        name: z.string(),
        status: z.string().optional()
    }))
});

export const GET = apiHandler(async (_req, params) => {
    const { id } = params;
    const { teams, contractor } = await ContractorService.getContractorTeams(id);
    return Response.json({ teams, contractor });
});

export const POST = apiHandler(async (_req, params, body) => {
    const { id } = params;
    const data = saveTeamsSchema.parse(body);
    await ContractorService.saveContractorTeams(id, data.teams);
    return Response.json({ success: true });
}, {
    audit: { action: 'UPDATE_TEAMS', entity: 'Contractor' }
});
