import { apiHandler } from '@/lib/api-handler';
import { AppError } from '@/lib/error';
import { BudgetAllocationService } from '@/services/finance/budget-allocation.service';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { assertOpmcAccess, requireAnyPermission } from '@/lib/project-record-access';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const UpdateBudgetSchema = z.object({
  allocatedAmount: z.number().positive().optional(),
  description: z.string().max(500).optional(),
  status: z.enum(['ACTIVE', 'FROZEN', 'REVISED']).optional(),
});

// ── GET — Get a single budget by ID ───────────────────────────────────────────

export const GET = apiHandler(async (_req, params) => {
  const id = params.id;
  if (!id) throw AppError.badRequest('Budget ID required');

  const budget = await BudgetAllocationService.getBudgetById(id);
  if (!budget) throw AppError.notFound('Budget allocation not found');
  await assertOpmcAccess(budget.opmcId, params._userId);

  return budget;
}, {
  rawResponse: true,
});

// ── PUT — Update a budget allocation ──────────────────────────────────────────

export const PUT = apiHandler(async (_req, params, body) => {
  const id = params.id;
  if (!id) throw AppError.badRequest('Budget ID required');

  const userId = params._userId;
  const existing = await BudgetAllocationService.getBudgetById(id);
  if (!existing) throw AppError.notFound('Budget allocation not found');
  await assertOpmcAccess(existing.opmcId, userId);

  const { ...rest } = body;
  if (body.status === 'FROZEN') {
    if (!userId) throw AppError.unauthorized('Authentication required');
    await requireAnyPermission(userId, [RBAC_PERMISSIONS.FINANCE_APPROVE], 'finance.approve is required to freeze a budget');
  }

  const updated = await BudgetAllocationService.updateBudget(id, {
    ...rest,
    ...(body.status === 'FROZEN' && { approvedById: userId ?? undefined }),
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

  const userId = params._userId;
  const existing = await BudgetAllocationService.getBudgetById(id);
  if (!existing) throw AppError.notFound('Budget allocation not found');
  await assertOpmcAccess(existing.opmcId, userId);
  await requireAnyPermission(userId, [RBAC_PERMISSIONS.FINANCE_APPROVE], 'finance.approve is required to freeze a budget');

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
