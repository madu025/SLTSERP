import { ROLE_GROUPS } from '@/config/roles';
import { apiHandler } from '@/lib/api-handler';
import { HeaderMappingService, MappingColumnDTO } from '@/services/sf-audit/header-mapping.service';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(
    async () => {
        return await HeaderMappingService.getMappingConfig();
    },
    { roles: ROLE_GROUPS.PROJECT_MANAGERS }
);

const columnSchema = z.object({
    key: z.string(),
    label: z.string(),
    description: z.string(),
    category: z.string().optional(),
    syncMode: z.enum(['AUTO', 'MANUAL']).optional(),
    terms: z.array(z.string())
});

const saveMappingSchema = z.object({
    columns: z.array(columnSchema)
});

export const POST = apiHandler(
    async (_req, _params, body) => {
        const { columns } = body;
        const result = await HeaderMappingService.saveMappingConfig(columns as MappingColumnDTO[]);
        return {
            message: 'SF Audit Invoice Material Header & Column Mapping saved successfully',
            columns: result.columns
        };
    },
    {
        roles: ROLE_GROUPS.FINANCE_APPROVERS,
        schema: saveMappingSchema,
        audit: { action: 'SAVE_CONFIG', entity: 'SF_MAPPING_CONFIG' }
    }
);

export const DELETE = apiHandler(
    async () => {
        const result = await HeaderMappingService.resetToDefault();
        return {
            message: 'Header mapping rules reset to standard SLT defaults successfully',
            columns: result.columns
        };
    },
    {
        roles: ROLE_GROUPS.FINANCE_APPROVERS,
        audit: { action: 'RESET_CONFIG', entity: 'SF_MAPPING_CONFIG' }
    }
);
