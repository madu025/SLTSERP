import { apiHandler } from '@/lib/api-handler';
import { AppError } from '@/lib/error';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { LedgerBudgetService } from '@/services/finance/ledger-budget.service';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

// GET /api/finance/budget-vs-actual?year=2026&opmcId=
// Budget vs posted-ledger actual per revenue / expense account. Company-wide budgets are for unscoped users only.
export const GET = apiHandler(async (req, params) => {
    const { searchParams } = new URL(req.url);
    const year = Number(searchParams.get('year') ?? new Date().getUTCFullYear());
    if (!Number.isInteger(year) || year < 2020 || year > 2100) throw AppError.badRequest('year must be between 2020 and 2100');
    return LedgerBudgetService.getBudgetVsActual(params._userId, year, searchParams.get('opmcId'));
}, { permissions: [RBAC_PERMISSIONS.FINANCE_READ] });

const SetBudgetSchema = z.object({
    fiscalYear: z.number().int().min(2020).max(2100),
    accountCode: z.string().min(1),
    opmcId: z.string().uuid().nullable().optional(),
    annual: z.number().min(0).optional(),
    monthly: z.array(z.number().min(0)).length(12).optional(),
    note: z.string().max(300).optional(),
}).refine((v) => v.annual !== undefined || v.monthly !== undefined, { message: 'annual or monthly is required' });

// PUT /api/finance/budget-vs-actual — set the 12 monthly budget lines of one account (annual is spread evenly).
export const PUT = apiHandler(async (req, params) => {
    const body = SetBudgetSchema.parse(await req.json());
    return LedgerBudgetService.setAccountBudget(params._userId, body);
}, { permissions: [RBAC_PERMISSIONS.FINANCE_WRITE] });
