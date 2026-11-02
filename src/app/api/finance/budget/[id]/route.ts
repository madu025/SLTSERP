import { getAuthenticatedUserId } from '@/lib/request-context';
import { apiHandler } from '@/lib/api-handler';
import { AppError } from '@/lib/error';
import { resolveUserId } from '@/lib/uuid';
import { BudgetAllocationService } from '@/services/finance/budget-allocation.service';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const UpdateBudgetSchema = z.object({
  allocatedAmount: z.number().positive().optional(),
  description: z.string().max(500).optional(),
  status: z.enum(['ACTIVE', 'FROZEN', 'REVISED']).optional(),
  approvedById: z.string().optional(),
});

// ── GET — Get a single budget by ID ───────────────────────────────────────────

export const GET = apiHandler(async (_req, params) => {
  const id = params.id;
  if (!id) throw AppError.badRequest('Budget ID required');

  const budget = await BudgetAllocationService.getBudgetById(id);
  if (!budget) throw AppError.notFound('Budget allocation not found');

  return budget;
}, {
  rawResponse: true,
});

// ── PUT — Update a budget allocation ──────────────────────────────────────────

export const PUT = apiHandler(async (req, params, body) => {
  const id = params.id;
  if (!id) throw AppError.badRequest('Budget ID required');

  const userId = getAuthenticatedUserId() ?? undefined;

  // approvedById is a uuid column — never trust client placeholders like 'system'
  const { approvedById: bodyApprover, ...rest } = body;

  const updated = await BudgetAllocationService.updateBudget(id, {
    ...rest,
    ...(body.status === 'FROZEN' && { approvedById: resolveUserId(bodyApprover, userId) ?? undefined }),
  });

  return { success: true, data: updated };
}, {
  schema: UpdateBudgetSchema,
  audit: { action: 'UPDATE', entity: 'FINANCE_BUDGET_ALLOCATION' },
  rawResponse: true,
});

// ── DELETE — Soft-delete (freeze) a budget allocation ─────────────────────────

export const DELETE = apiHandler(async (_req, params) => {
  const id = params.id;
  if (!id) throw AppError.badRequest('Budget ID required');

  try {
    await BudgetAllocationService.deleteBudget(id);
    return { success: true };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : '';
    if (msg === 'BUDGET_NOT_FOUND') throw AppError.notFound('Budget not found');
    if (msg === 'BUDGET_FROZEN') throw AppError.badRequest('Budget is already frozen');
    throw error;
  }
}, {
  audit: { action: 'DELETE', entity: 'FINANCE_BUDGET_ALLOCATION' },
  rawResponse: true,
});
