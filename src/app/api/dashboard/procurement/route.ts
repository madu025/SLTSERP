import { z } from 'zod';
import { apiHandler } from '@/lib/api-handler';
import { DashboardService } from '@/services/core/dashboard.service';
import { ROLE_GROUPS } from '@/config/roles';

export const dynamic = 'force-dynamic';

const querySchema = z.object({
    rtom: z.string().optional().default('ALL'),
});

export const GET = apiHandler(async (req) => {
    const { searchParams } = new URL(req.url);
    const parsed = querySchema.parse(Object.fromEntries(searchParams));

    return await DashboardService.getProcurementMetrics(parsed.rtom);
}, {
    roles: ROLE_GROUPS.PROCUREMENT,
    rawResponse: true
});
