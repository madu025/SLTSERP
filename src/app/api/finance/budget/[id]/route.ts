import { apiHandler } from '@/lib/api-handler';
import { AppError } from '@/lib/error';
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
  const id = (params as Record<string, string>)?.id;
  if (!id) throw AppError.badRequest('Budget ID required');

  const budget = await BudgetAllocationService.getBudgetById(id);
  if (!budget) throw AppError.notFound('Budget allocation not found');

  return budget;
}, {
  roles: ['SUPER_ADMIN', 'ADMIN', 'FINANCE_MANAGER', 'FINANCE_ASSISTANT'],
  rawResponse: true,
});

// ── PUT — Update a budget allocation ──────────────────────────────────────────

export const PUT = apiHandler(async (req, params, body) => {
  const id = (params as Record<string, string>)?.id;
  if (!id) throw AppError.badRequest('Budget ID required');

  const userId = req.headers.get('x-user-id') ?? undefined;

  const updated = await BudgetAllocationService.updateBudget(id, {
    ...body,
    ...(body.status === 'FROZEN' && { approvedById: userId }),
  });

  return { success: true, data: updated };
}, {
  schema: UpdateBudgetSchema,
  roles: ['SUPER_ADMIN', 'ADMIN', 'FINANCE_MANAGER'],
  audit: { action: 'UPDATE', entity: 'FINANCE_BUDGET_ALLOCATION' },
  rawResponse: true,
});

// ── DELETE — Soft-delete (freeze) a budget allocation ─────────────────────────

export const DELETE = apiHandler(async (_req, params) => {
  const id = (params as Record<string, string>)?.id;
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
  roles: ['SUPER_ADMIN', 'ADMIN', 'FINANCE_MANAGER'],
  audit: { action: 'DELETE', entity: 'FINANCE_BUDGET_ALLOCATION' },
  rawResponse: true,
});
