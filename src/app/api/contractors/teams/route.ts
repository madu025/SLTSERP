import { apiHandler } from '@/lib/api-handler';
import { ContractorService } from '@/services/contractor.service';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET: List all contractor teams with contractor name
 */
export const GET = apiHandler(async () => {
    const teams = await ContractorService.getAllTeams();
    return Response.json(teams);
});