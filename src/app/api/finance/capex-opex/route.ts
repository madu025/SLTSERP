import { ROLE_GROUPS } from '@/config/roles';
import { apiHandler } from '@/lib/api-handler';
import { AppError } from '@/lib/error';
import { CapexOpexLedgerService } from '@/services/finance/capex-opex-ledger.service';
import {
  type ExpenditureType,
  type SpendCategory,
  type LedgerSourceType,
} from '@/services/finance/capex-opex-types';
import { z } from 'zod';
import { assertProjectAccess } from '@/lib/project-access';
import { resolveOpmcScope } from '@/lib/opmc-scope';
import { assertOpmcAccess } from '@/lib/project-record-access';

export const dynamic = 'force-dynamic';

// ── Zod Schemas ───────────────────────────────────────────────────────────────

const CreateLedgerEntrySchema = z.object({
  opmcId: z.string().min(1),
  expenditureType: z.enum(['CAPEX', 'OPEX']),
  category: z.enum([
    'NETWORK_INFRA', 'MAINTENANCE', 'CONTRACTOR_PAYMENT',
    'PETTY_CASH', 'VEHICLE', 'EQUIPMENT', 'OTHER',
  ]),
  sourceType: z.enum([
    'PROJECT_EXPENSE', 'INVOICE', 'PETTY_CASH',
    'PURCHASE_ORDER', 'VEHICLE_TRIP', 'PAYMENT_VOUCHER', 'MANUAL',
  ]),
  sourceId: z.string().min(1),
  amount: z.number().positive(),
  transactionDate: z.string().datetime().optional(),
  description: z.string().min(1).max(500),
  referenceNumber: z.string().optional(),
  vendorId: z.string().optional(),
  projectId: z.string().optional(),
  budgetId: z.string().optional(),
});

// ── GET — Paginated ledger entries ────────────────────────────────────────────

export const GET = apiHandler(async (request, ctx) => {
  const { searchParams } = new URL(request.url);

  const params = {
    opmcId: searchParams.get('opmcId') ?? undefined,
    fiscalYear: searchParams.get('fiscalYear') ? Number(searchParams.get('fiscalYear')) : undefined,
    quarter: searchParams.get('quarter') ? Number(searchParams.get('quarter')) : undefined,
    expenditureType: (searchParams.get('expenditureType') as ExpenditureType) ?? undefined,
    category: (searchParams.get('category') as SpendCategory) ?? undefined,
    sourceType: (searchParams.get('sourceType') as LedgerSourceType) ?? undefined,
    page: searchParams.get('page') ? Number(searchParams.get('page')) : 1,
    limit: searchParams.get('limit') ? Number(searchParams.get('limit')) : 20,
  };

  // OPMC boundary: an explicit opmcId must be in scope; scoped users without one are pinned to their only OPMC.
  if (params.opmcId) {
    await assertOpmcAccess(params.opmcId, ctx._userId);
  } else {
    const scope = await resolveOpmcScope(ctx._userId);
    if (scope !== undefined) {
      if (scope.length === 0) throw AppError.forbidden('You are not assigned to any OPMC scope');
      if (scope.length > 1) throw AppError.badRequest('opmcId is required');
      params.opmcId = scope[0];
    }
  }

  return CapexOpexLedgerService.getEntries(params);
}, {
  roles: ROLE_GROUPS.PROJECT_MANAGERS,
  rawResponse: true,
});

// ── POST — Create manual ledger entry ─────────────────────────────────────────

export const POST = apiHandler(async (_req, ctx, body) => {
  const userId = ctx._userId;
  if (!userId) throw AppError.unauthorized('Authentication required');
  await assertOpmcAccess(body.opmcId, userId);
  if (body.projectId) await assertProjectAccess(body.projectId, userId);

  const result = await CapexOpexLedgerService.recordEntry({
    ...body,
    sourceType: 'MANUAL' as LedgerSourceType,
    transactionDate: body.transactionDate ? new Date(body.transactionDate as string) : undefined,
    createdById: userId,
  });

  return { success: true, data: result };
}, {
  schema: CreateLedgerEntrySchema,
  roles: ROLE_GROUPS.FINANCE_APPROVERS,
  audit: { action: 'CREATE', entity: 'CAPEX_OPEX_LEDGER_ENTRY' },
  rawResponse: true,
});
