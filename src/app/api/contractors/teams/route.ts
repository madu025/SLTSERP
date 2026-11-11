import { apiHandler } from '@/lib/api-handler';
import { ContractorAccess } from '@/services/contractor/contractor-access';
import { getAuthenticatedUserId } from '@/lib/request-context';
import { ContractorService } from '@/services/contractor/contractor.service';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET: List all contractor teams with contractor name
 */
export const GET = apiHandler(
    async () => {
        await ContractorAccess.assertStaff(getAuthenticatedUserId());
        const teams = await ContractorService.getAllTeams();
        return Response.json(teams);
    },
    {}
);
