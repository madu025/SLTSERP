import { z } from 'zod';
import { apiHandler } from '@/lib/api-handler';
import { TrafficService } from '@/services/system/traffic.service';
import { ROLE_GROUPS } from '@/config/roles';
import { AuditService } from '@/services/audit/audit.service';

const schema = z.object({
    identifier: z.string().min(1),
    action: z.enum(['BLOCK', 'UNBLOCK'])
});

export const POST = apiHandler(
    async (req: Request) => {
        const body = await req.json();
        const { identifier, action } = schema.parse(body);
        const userId = req.headers.get('x-user-id') || 'system';

        if (action === 'BLOCK') {
            await TrafficService.blockEntity(identifier);
            await AuditService.log({
                userId,
                action: 'TRAFFIC_BLOCK_ENTITY',
                entity: 'SystemTraffic',
                entityId: identifier,
                newValue: { action: 'BLOCK' }
            });
        } else {
            await TrafficService.unblockEntity(identifier);
            await AuditService.log({
                userId,
                action: 'TRAFFIC_UNBLOCK_ENTITY',
                entity: 'SystemTraffic',
                entityId: identifier,
                newValue: { action: 'UNBLOCK' }
            });
        }

        return {
            success: true,
            message: `Entity ${identifier} successfully ${action.toLowerCase()}ed.`
        };
    },
    {
        roles: ROLE_GROUPS.ADMINS
    }
);
