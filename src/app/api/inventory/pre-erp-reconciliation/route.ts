import { apiHandler } from '@/lib/api-handler';
import { AppError } from '@/lib/error';
import { PreErpReconciliationService } from '@/services/inventory/pre-erp-reconciliation.service';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const SingleBalanceSchema = z.object({
  opmcId: z.string().optional().nullable(),
  itemId: z.string().min(1),
  year: z.number().int().min(2020).max(2100),
  month: z.string().min(1),
  carryForwardQuantity: z.number().min(0),
  receivedQuantity: z.number().min(0),
  usageQuantity: z.number().min(0),
  wastageQuantity: z.number().min(0).optional(),
  faultyQuantity: z.number().min(0).optional(),
  unitCostLkr: z.number().min(0).optional(),
});

const BulkBalanceSchema = z.object({
  items: z.array(SingleBalanceSchema).min(1),
});

export const GET = apiHandler(async (request) => {
  const { searchParams } = new URL(request.url);

  const params = {
    opmcId: searchParams.get('opmcId') ?? undefined,
    year: searchParams.get('year') ? Number(searchParams.get('year')) : undefined,
    month: searchParams.get('month') ?? undefined,
    itemId: searchParams.get('itemId') ?? undefined,
    status: searchParams.get('status') ?? undefined,
    page: searchParams.get('page') ? Number(searchParams.get('page')) : 1,
    limit: searchParams.get('limit') ? Number(searchParams.get('limit')) : 500,
  };

  return PreErpReconciliationService.listBalances(params);
}, {
  roles: ['SUPER_ADMIN', 'ADMIN', 'STORES_MANAGER', 'STORES_ASSISTANT', 'FINANCE_MANAGER'],
  rawResponse: true,
});

export const POST = apiHandler(async (req, _params, body) => {
  const userId = req.headers.get('x-user-id');
  if (!userId) throw AppError.unauthorized('Authentication required');

  if (Array.isArray((body as { items?: unknown[] }).items)) {
    const bulkBody = body as z.infer<typeof BulkBalanceSchema>;
    const inputs = bulkBody.items.map((item) => ({
      ...item,
      opmcId: item.opmcId ?? '',
      createdById: userId,
    }));
    const result = await PreErpReconciliationService.bulkUpsertMonthBalances(inputs);
    return { success: true, ...result };
  } else {
    const singleBody = body as z.infer<typeof SingleBalanceSchema>;
    const result = await PreErpReconciliationService.upsertManualBalance({
      ...singleBody,
      opmcId: singleBody.opmcId ?? '',
      createdById: userId,
    });
    return { success: true, data: result };
  }
}, {
  roles: ['SUPER_ADMIN', 'ADMIN', 'STORES_MANAGER', 'STORES_ASSISTANT'],
  audit: { action: 'UPSERT', entity: 'PRE_ERP_MATERIAL_BALANCE' },
  rawResponse: true,
});
