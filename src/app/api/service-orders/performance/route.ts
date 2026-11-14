import { apiHandler } from '@/lib/api-handler';
import { AppError } from '@/lib/error';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { SodPerformanceService } from '@/services/service-order/sod-performance.service';

export const dynamic = 'force-dynamic';

const DAY_MS = 24 * 3600 * 1000;
const MAX_WINDOW_DAYS = 400;

// GET /api/service-orders/performance?from=&to=
// Turnaround / SLA, backlog ageing, capacity, return reasons and team productivity.
// OPMC scope is enforced in the service; the window defaults to the last 30 days.
export const GET = apiHandler(async (req, params) => {
    const { searchParams } = new URL(req.url);
    const to = searchParams.get('to') ? new Date(searchParams.get('to')!) : new Date();
    const from = searchParams.get('from') ? new Date(searchParams.get('from')!) : new Date(to.getTime() - 30 * DAY_MS);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) throw AppError.badRequest('from/to must be valid dates');
    if (from > to) throw AppError.badRequest('from must be before to');
    if ((to.getTime() - from.getTime()) / DAY_MS > MAX_WINDOW_DAYS) throw AppError.badRequest(`The window cannot exceed ${MAX_WINDOW_DAYS} days`);
    return SodPerformanceService.getReport(params._userId, from, to);
}, { permissions: [RBAC_PERMISSIONS.SOD_READ] });
