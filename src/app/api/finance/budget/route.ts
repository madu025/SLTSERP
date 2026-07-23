import { apiHandler } from '@/lib/api-handler';
import { AppError } from '@/lib/error';
import { BudgetAllocationService } from '@/services/finance/budget-allocation.service';
import { type ExpenditureType, type BudgetStatus } from '@/services/finance/capex-opex-types';
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

export const GET = apiHandler(async (request) => {
  const { searchParams } = new URL(request.url);

  const params = {
    opmcId: searchParams.get('opmcId') ?? undefined,
    fiscalYear: searchParams.get('fiscalYear') ? Number(searchParams.get('fiscalYear')) : undefined,
    expenditureType: (searchParams.get('expenditureType') as ExpenditureType) ?? undefined,
    status: (searchParams.get('status') as BudgetStatus) ?? undefined,
  };

  return BudgetAllocationService.listBudgets(params);
}, {
  roles: ['SUPER_ADMIN', 'ADMIN', 'FINANCE_MANAGER', 'FINANCE_ASSISTANT', 'OSP_MANAGER'],
  rawResponse: true,
});

// ── POST — Create a new budget allocation ─────────────────────────────────────

export const POST = apiHandler(async (req, _params, body) => {
  const userId = req.headers.get('x-user-id');
  if (!userId) throw AppError.unauthorized('Authentication required');

  const budget = await BudgetAllocationService.createBudget({
    ...body,
    createdById: userId,
  });

  return { success: true, data: budget };
}, {
  schema: CreateBudgetSchema,
  roles: ['SUPER_ADMIN', 'ADMIN', 'FINANCE_MANAGER'],
  audit: { action: 'CREATE', entity: 'FINANCE_BUDGET_ALLOCATION' },
  rawResponse: true,
});
