import { apiHandler } from '@/lib/api-handler';
import { HeaderMappingService, MappingColumnDTO } from '@/services/sf-audit/header-mapping.service';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(
    async () => {
        return await HeaderMappingService.getMappingConfig();
    },
    { roles: ['ADMIN', 'SUPER_ADMIN', 'FINANCE_MANAGER', 'AUDITOR', 'ENGINEER', 'SF_AUDIT', 'SF_AUDIT_OFFICER', 'SF_AUDIT_MANAGER'] }
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
    async (_req: Request, _context: { params?: Record<string, string> }, body: { columns: MappingColumnDTO[] }) => {
        const { columns } = body;
        const result = await HeaderMappingService.saveMappingConfig(columns);
        return {
            message: 'SF Audit Invoice Material Header & Column Mapping saved successfully',
            columns: result.columns
        };
    },
    {
        roles: ['ADMIN', 'SUPER_ADMIN', 'FINANCE_MANAGER', 'AUDITOR', 'SF_AUDIT', 'SF_AUDIT_OFFICER', 'SF_AUDIT_MANAGER'],
        schema: saveMappingSchema
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
        roles: ['ADMIN', 'SUPER_ADMIN', 'FINANCE_MANAGER', 'AUDITOR', 'SF_AUDIT_MANAGER']
    }
);
