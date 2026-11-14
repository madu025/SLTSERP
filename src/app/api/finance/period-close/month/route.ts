import { apiHandler } from '@/lib/api-handler';
import { AppError } from '@/lib/error';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { resolveOpmcScope } from '@/lib/opmc-scope';
import { FiscalPeriodService } from '@/services/finance/fiscal-period.service';

export const dynamic = 'force-dynamic';

const schema = z.object({
    year: z.number().int().min(2000).max(2100),
    month: z.number().int().min(1).max(12),
    action: z.enum(['CLOSE', 'REOPEN']),
});

// POST /api/finance/period-close/month
// Month-end close and reopen. CLOSE needs a finished month and no journals waiting for approval in it; REOPEN is refused
// for LOCKED periods (those were closed by the year-end close). Every change is audited with who and which month.
export const POST = apiHandler(async (_req, params, body: z.infer<typeof schema>) => {
    if (!params._userId) throw AppError.unauthorized('Authentication required');
    if (await resolveOpmcScope(params._userId) !== undefined) throw AppError.forbidden('Period close requires global Finance scope');

    const { year, month, action } = body;
    const start = new Date(Date.UTC(year, month - 1, 1));
    const end = new Date(Date.UTC(year, month, 1));
    const existing = await prisma.fiscalPeriod.findUnique({ where: { year_month: { year, month } } });

    if (action === 'CLOSE') {
        if (end > new Date()) throw AppError.badRequest('A month can only be closed after it has ended');
        if (existing?.status === 'LOCKED') throw AppError.badRequest('This period is locked by the year-end close');
        const pending = await prisma.journalEntry.count({ where: { date: { gte: start, lt: end }, status: { in: ['DRAFT', 'PENDING_APPROVAL'] } } });
        if (pending > 0) throw AppError.badRequest(`${pending} journal entr${pending === 1 ? 'y is' : 'ies are'} still waiting for approval in this month`);
        const period = await FiscalPeriodService.setPeriodStatus(year, month, 'CLOSED', params._userId);
        return { period };
    }

    if (existing?.status === 'LOCKED') throw AppError.badRequest('A period locked by the year-end close cannot be reopened here');
    const period = await FiscalPeriodService.setPeriodStatus(year, month, 'OPEN', params._userId);
    return { period };
}, {
    schema,
    permissions: [RBAC_PERMISSIONS.FINANCE_APPROVE],
    audit: { action: 'CHANGE_PERIOD_STATUS', entity: 'FISCAL_PERIOD' },
});
