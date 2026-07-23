import { apiHandler } from '@/lib/api-handler';
import { AppError } from '@/lib/error';
import { CapexOpexLedgerService } from '@/services/finance/capex-opex-ledger.service';
import {
  type ExpenditureType,
  type SpendCategory,
  type LedgerSourceType,
} from '@/services/finance/capex-opex-types';
import { z } from 'zod';

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

export const GET = apiHandler(async (request) => {
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

  return CapexOpexLedgerService.getEntries(params);
}, {
  roles: ['SUPER_ADMIN', 'ADMIN', 'FINANCE_MANAGER', 'FINANCE_ASSISTANT', 'OSP_MANAGER', 'AREA_MANAGER'],
  rawResponse: true,
});

// ── POST — Create manual ledger entry ─────────────────────────────────────────

export const POST = apiHandler(async (_req, _params, body) => {
  const userId = _req.headers.get('x-user-id');
  if (!userId) throw AppError.unauthorized('Authentication required');

  const result = await CapexOpexLedgerService.recordEntry({
    ...body,
    sourceType: 'MANUAL' as LedgerSourceType,
    transactionDate: body.transactionDate ? new Date(body.transactionDate as string) : undefined,
    createdById: userId,
  });

  return { success: true, data: result };
}, {
  schema: CreateLedgerEntrySchema,
  roles: ['SUPER_ADMIN', 'ADMIN', 'FINANCE_MANAGER'],
  audit: { action: 'CREATE', entity: 'CAPEX_OPEX_LEDGER_ENTRY' },
  rawResponse: true,
});
