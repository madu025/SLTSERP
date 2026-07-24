import { apiHandler } from '@/lib/api-handler';
import { ContractorService } from '@/services/contractor.service';
import { TeamInput } from '@/services/contractor/contractor-types';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

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

const saveTeamsSchema = z.object({
    teams: z.array(z.object({
        id: z.string().optional(),
        name: z.string(),
        opmcId: z.string().nullable().optional(),
        sltCode: z.string().nullable().optional(),
        status: z.string().optional(),
        storeAssignments: z.array(z.object({ storeId: z.string(), isPrimary: z.boolean().optional() })).optional(),
        members: z.array(z.object({
            id: z.string().optional(),
            name: z.string(),
            nic: z.string().optional(),
            idCopyNumber: z.string().optional(),
            contactNumber: z.string().optional(),
            address: z.string().optional()
        }).passthrough()).optional()
    }).passthrough())
});

export const GET = apiHandler(
    async (_req, params) => {
        const { id } = params;
        const { teams, contractor } = await ContractorService.getContractorTeams(id);
        return { teams, contractor };
    },
    {
        roles: ALLOWED_READ_ROLES
    }
);

export const POST = apiHandler(
    async (_req, params, body) => {
        const { id } = params;
        const data = saveTeamsSchema.parse(body);
        await ContractorService.saveContractorTeams(id, data.teams as TeamInput[]);
        return { success: true, message: 'Teams saved successfully' };
    },
    {
        roles: ['ADMIN', 'SUPER_ADMIN', 'OFFICE_ADMIN', 'AREA_MANAGER', 'OSP_MANAGER'],
        audit: { action: 'UPDATE_TEAMS', entity: 'Contractor' }
    }
);
