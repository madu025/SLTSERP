import { apiHandler } from '@/lib/api-handler';
import { ContractorService } from '@/services/contractor.service';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const ALLOWED_READ_ROLES = [
    'SUPER_ADMIN',
    'ADMIN',
    'OFFICE_ADMIN',
    'OFFICE_ADMIN_ASSISTANT',
    'OSP_MANAGER',
    'AREA_MANAGER',
    'FINANCE_MANAGER',
    'FINANCE_ASSISTANT',
    'SITE_OFFICE_STAFF',
    'ENGINEER',
    'ASSISTANT_ENGINEER',
    'AREA_COORDINATOR',
    'MANAGER',
    'QC_OFFICER'
];

/**
 * GET: List all contractor teams with contractor name for Admin ERP
 */
export const GET = apiHandler(
    async () => {
        const teams = await ContractorService.getAllTeams();
        return Response.json(teams);
    },
    {
        roles: ALLOWED_READ_ROLES
    }
);
