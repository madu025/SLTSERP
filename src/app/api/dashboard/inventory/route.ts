import { z } from 'zod';
import { apiHandler } from '@/lib/api-handler';
import { DashboardService } from '@/services/core/dashboard.service';
import { resolveOpmcScope } from '@/lib/opmc-scope';

export const dynamic = 'force-dynamic';

const querySchema = z.object({
    userId: z.string().optional(),
    region: z.string().optional().default('ALL'),
    rtom: z.string().optional().default('ALL'),
});

export const GET = apiHandler(async (req, params) => {
    const { searchParams } = new URL(req.url);
    const parsed = querySchema.parse(Object.fromEntries(searchParams));

    // Identity/scope come from the session only — any client userId param is
    // ignored. OPMC scope is resolved server-side (admins unrestricted;
    // client rtom is validated against the scope inside the service).
    const accessibleOpmcs = await resolveOpmcScope(params._userId);

    return await DashboardService.getInventoryMetrics(parsed.rtom, accessibleOpmcs);
}, { menuPath: '/dashboard', rawResponse: true });

