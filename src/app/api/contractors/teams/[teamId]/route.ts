import { ROLE_GROUPS } from '@/config/roles';
import { apiHandler } from '@/lib/api-handler';
import { ContractorService } from '@/services/contractor/contractor.service';

export const dynamic = 'force-dynamic';

export const DELETE = apiHandler(async (_req, params) => {
    const { teamId } = params;
    await ContractorService.deleteTeam(teamId);
    return { success: true, message: `Team ${teamId} deleted successfully` };
}, {
    roles: ROLE_GROUPS.ADMINS,
    audit: { action: 'DELETE_CONTRACTOR_TEAM', entity: 'ContractorTeam' }
});
