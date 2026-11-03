import { apiHandler } from '@/lib/api-handler';
import { AppError } from '@/lib/error';
import { BudgetAllocationService } from '@/services/finance/budget-allocation.service';
import { type ExpenditureType, type BudgetStatus } from '@/services/finance/capex-opex-types';
import { assertOpmcAccess } from '@/lib/project-record-access';
import { resolveOpmcScope } from '@/lib/opmc-scope';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

// ── Zod Schemas ───────────────────────────────────────────────────────────────

const CreateBudgetSchema = z.object({
  opmcId: z.string().min(1),
  fiscalYear: z.number().int().min(2020).max(2100),
  quarter: z.number().int().min(1).max(4).optional(),
  expenditureType: z.enum(['CAPEX', 'OPEX']),
  category: z.enum([
    'NETWORK_INFRA', 'MAINTENANCE', 'CONTRACTOR_PAYMENT',
    'PETTY_CASH', 'VEHICLE', 'EQUIPMENT', 'OTHER',
  ]),
  allocatedAmount: z.number().positive(),
  description: z.string().max(500).optional(),
});

// ── GET — List budget allocations ─────────────────────────────────────────────

export const GET = apiHandler(async (request, ctx) => {
  const { searchParams } = new URL(request.url);
  const requestedOpmcId = searchParams.get('opmcId') ?? undefined;
  if (requestedOpmcId) await assertOpmcAccess(requestedOpmcId, ctx._userId);
  const scope = await resolveOpmcScope(ctx._userId);
  if (scope !== undefined && scope.length === 0) {
    throw AppError.forbidden('You are not assigned to any OPMC scope');
  }

  const params = {
    opmcId: requestedOpmcId ?? (scope?.length === 1 ? scope[0] : undefined),
    opmcIds: scope !== undefined && !requestedOpmcId && scope.length > 1 ? scope : undefined,
    fiscalYear: searchParams.get('fiscalYear') ? Number(searchParams.get('fiscalYear')) : undefined,
    expenditureType: (searchParams.get('expenditureType') as ExpenditureType) ?? undefined,
    status: (searchParams.get('status') as BudgetStatus) ?? undefined,
  };

  return BudgetAllocationService.listBudgets(params);
}, {
  rawResponse: true,
});

// ── POST — Create a new budget allocation ─────────────────────────────────────

export const POST = apiHandler(async (_req, ctx, body) => {
  const userId = ctx._userId;
  if (!userId) throw AppError.unauthorized('Authentication required');
  await assertOpmcAccess(body.opmcId, userId);

  const budget = await BudgetAllocationService.createBudget({
    ...body,
    createdById: userId,
  });

  return { success: true, data: budget };
}, {
  schema: CreateBudgetSchema,
  audit: { action: 'CREATE', entity: 'FINANCE_BUDGET_ALLOCATION' },
  rawResponse: true,
});
