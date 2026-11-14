import { apiHandler } from '@/lib/api-handler';
import { AppError } from '@/lib/error';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { OpsScoreboardService } from '@/services/service-order/ops-scoreboard.service';

export const dynamic = 'force-dynamic';

// GET /api/dashboard/ops-scoreboard?region=&rtom=&days=30
// RTOM scoreboard (backlog, SLA, returns, projects). OPMC scope is enforced in the service.
export const GET = apiHandler(async (req, params) => {
    const { searchParams } = new URL(req.url);
    const days = Number(searchParams.get('days') ?? 30);
    if (!Number.isInteger(days) || days < 7 || days > 180) throw AppError.badRequest('days must be between 7 and 180');
    return OpsScoreboardService.getScoreboard(params._userId, {
        region: searchParams.get('region') || undefined,
        rtom: searchParams.get('rtom') || undefined,
        windowDays: days,
    });
}, { permissions: [RBAC_PERMISSIONS.SOD_READ] });
