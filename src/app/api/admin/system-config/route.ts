export const dynamic = 'force-dynamic';

import { SystemConfigService } from '@/services/core/system-config.service';
import { apiHandler } from '@/lib/api-handler';
import { AppError } from '@/lib/error';
import { ROLE_GROUPS, hasRole } from '@/config/roles';
import { z } from 'zod';

const updateConfigSchema = z.object({
    key: z.string().min(1).max(100),
    value: z.union([z.string(), z.number(), z.boolean()]),
    description: z.string().max(500).optional()
});

export const GET = apiHandler(async () => {
    return SystemConfigService.getConfigs();
}, { rawResponse: true, roles: ROLE_GROUPS.ADMINS });

export const POST = apiHandler(async (request, _params, body) => {
    const userId = request.headers.get('x-user-id');
    const { key, value, description } = updateConfigSchema.parse(body);
    return SystemConfigService.updateConfig(key, String(value), description, userId || 'system');
}, {
    rawResponse: true,
    roles: ROLE_GROUPS.SUPER_ADMINS,
    audit: { action: 'UPDATE', entity: 'SYSTEM_CONFIG' }
});
