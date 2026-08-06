import { z } from 'zod';
import { apiHandler } from '@/lib/api-handler';
import { DashboardService } from '@/services/core/dashboard.service';
import { ROLE_GROUPS } from '@/config/roles';
import { resolveOpmcScope } from '@/lib/opmc-scope';

export const dynamic = 'force-dynamic';

const querySchema = z.object({
    rtom: z.string().optional().default('ALL'),
});

export const GET = apiHandler(async (req, params) => {
    const { searchParams } = new URL(req.url);
    const parsed = querySchema.parse(Object.fromEntries(searchParams));

    // Server-side OPMC scope — client rtom is validated against it inside
    // the service (admins unrestricted, empty scope denies all).
    const accessibleOpmcs = await resolveOpmcScope(params._userId);

    return await DashboardService.getProcurementMetrics(parsed.rtom, accessibleOpmcs);
}, {
    roles: ROLE_GROUPS.PROCUREMENT,
    rawResponse: true
});
