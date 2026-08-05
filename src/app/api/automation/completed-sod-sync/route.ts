import { ROLE_GROUPS } from '@/config/roles';
export const dynamic = 'force-dynamic';

import { apiHandler } from '@/lib/api-handler';
import { CompletedSODSyncService } from '@/services/service-order/completed-sod-sync.service';
import { z } from 'zod';

const SyncSchema = z.object({
    startDate: z.string().optional()
});

export const POST = apiHandler(
    async (req, params, body: z.infer<typeof SyncSchema>) => {
        const { startDate } = body;

        console.log(`[API] Manual Completed SOD Sync triggered (Start Date: ${startDate || 'Default'})`);
        const result = await CompletedSODSyncService.syncCompletedSODs(startDate);

        return result;
    },
    {
        schema: SyncSchema,
        roles: ROLE_GROUPS.ADMINS,
        audit: {
            action: 'MANUAL_COMPLETED_SOD_SYNC',
            entity: 'ServiceOrder'
        }
    }
);
