import { apiHandler } from '@/lib/api-handler';
import { ContractorService } from '@/services/contractor/contractor.service';

export const dynamic = 'force-dynamic';

/**
 * GET: List all contractor teams with contractor name for Admin ERP
 */
export const GET = apiHandler(
    async () => {
        const teams = await ContractorService.getAllTeams();
        return teams;
    },
    {
    }
);
