import { z } from 'zod';
import { apiHandler } from '@/lib/api-handler';
import { AppError } from '@/lib/error';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { HoMonthlyService } from '@/services/finance/ho-monthly.service';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({ month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/), hoBalance: z.number().finite(), note: z.string().trim().max(1000).nullish() });

// GET /api/finance/ho/reconciliation?month=YYYY-MM - past reconciliations, plus the ledger balance for the month when asked
export const GET = apiHandler(async (req, params) => {
    const month = new URL(req.url).searchParams.get('month');
    const history = await HoMonthlyService.reconciliations(params._userId ?? '');
    return { history, ledgerBalance: month ? await HoMonthlyService.ledgerBalanceAt(month) : null };
}, { permissions: [RBAC_PERMISSIONS.FINANCE_READ] });

// POST /api/finance/ho/reconciliation { month, hoBalance, note } - record Head Office's own closing balance for a month
export const POST = apiHandler(async (_req, params, body: z.infer<typeof bodySchema>) => {
    if (!params._userId) throw AppError.unauthorized('Authentication required');
    return HoMonthlyService.record(params._userId, body);
}, { schema: bodySchema, permissions: [RBAC_PERMISSIONS.FINANCE_HO_SUBMIT], audit: { action: 'HO_RECONCILE', entity: 'HO_RECONCILIATION' } });
