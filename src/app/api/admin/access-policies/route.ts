
import { apiHandler } from '@/lib/api-handler';
import { z } from 'zod';
import { SystemSettingService } from '@/services/core/system-setting.service';
import { ROLE_GROUPS, hasRole } from '@/config/roles';
import { AppError } from '@/lib/error';

const accessPolicySchema = z.object({
    policies: z.record(z.string(), z.array(z.string()))
});

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async () => {
    const policies = await SystemSettingService.getSetting('PAGE_ACCESS_POLICIES') || {};
    return policies;
});

export const POST = apiHandler<{ success: boolean }, z.infer<typeof accessPolicySchema>>(
    async (_request, _params, body) => {
        await SystemSettingService.upsertSetting('PAGE_ACCESS_POLICIES', body.policies);
        return { success: true };
    },
    {
        schema: accessPolicySchema,
        roles: ROLE_GROUPS.CORE_ADMINS,
        audit: { action: 'SAVE_POLICIES', entity: 'ACCESS_POLICY' }
    }
);
