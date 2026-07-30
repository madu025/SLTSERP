
import { apiHandler } from '@/lib/api-handler';
import { z } from 'zod';
import { SystemSettingService } from '@/services/core/system-setting.service';

const accessPolicySchema = z.object({
    policies: z.record(z.string(), z.array(z.string()))
});

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async () => {
    const policies = await SystemSettingService.getSetting('PAGE_ACCESS_POLICIES') || {};
    return policies;
});

export const POST = apiHandler<{ success: boolean }, z.infer<typeof accessPolicySchema>>(
    async (request, params, body) => {
        const adminRole = request.headers.get('x-user-role');
        if (adminRole !== 'SUPER_ADMIN' && adminRole !== 'ADMIN') {
            throw new Error('Unauthorized');
        }

        await SystemSettingService.upsertSetting('PAGE_ACCESS_POLICIES', body.policies);

        return { success: true };
    },
    { schema: accessPolicySchema }
);
