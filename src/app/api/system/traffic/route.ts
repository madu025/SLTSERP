import { apiHandler } from '@/lib/api-handler';
import { TrafficService } from '@/services/system/traffic.service';
import { ROLE_GROUPS } from '@/config/roles';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(
    async () => {
        const liveTraffic = await TrafficService.getLiveTraffic();
        const blockedList = await TrafficService.getBlockedList();

        return {
            success: true,
            traffic: liveTraffic,
            blocked: blockedList
        };
    },
    {
        roles: ROLE_GROUPS.ADMINS
    }
);
