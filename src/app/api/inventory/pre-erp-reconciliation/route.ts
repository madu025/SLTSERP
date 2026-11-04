import { apiHandler } from '@/lib/api-handler';
import { databaseUuidSchema } from '@/lib/validations/uuid.schema';
import { AppError } from '@/lib/error';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { PreErpReconciliationService } from '@/services/inventory/pre-erp-reconciliation.service';
import { assertOpmcAccess } from '@/lib/project-record-access';
import { resolveOpmcScope } from '@/lib/opmc-scope';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const SingleBalanceSchema = z.object({
  opmcId: databaseUuidSchema,
  itemId: databaseUuidSchema,
  year: z.number().int().min(2020).max(2100),
  month: z.enum(['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER']),
  carryForwardQuantity: z.number().finite().min(0),
  receivedQuantity: z.number().finite().min(0),
  usageQuantity: z.number().finite().min(0),
  wastageQuantity: z.number().finite().min(0).optional(),
  faultyQuantity: z.number().finite().min(0).optional(),
  unitCostLkr: z.number().finite().min(0).optional(),
});

const BulkBalanceSchema = z.object({
  items: z.array(SingleBalanceSchema).min(1),
}).strict();

export const GET = apiHandler(async (request, params) => {
  const { searchParams } = new URL(request.url);
  const requestedOpmcId = searchParams.get('opmcId') ?? undefined;
  if (requestedOpmcId) await assertOpmcAccess(requestedOpmcId, params._userId);
  const scope = await resolveOpmcScope(params._userId);
  if (scope !== undefined && scope.length === 0) throw AppError.forbidden('You are not assigned to any OPMC scope');

  const queryParams = {
    opmcId: requestedOpmcId ?? (scope?.length === 1 ? scope[0] : undefined),
    opmcIds: scope !== undefined && !requestedOpmcId && scope.length > 1 ? scope : undefined,
    year: searchParams.get('year') ? Number(searchParams.get('year')) : undefined,
    month: searchParams.get('month') ?? undefined,
    itemId: searchParams.get('itemId') ?? undefined,
    status: searchParams.get('status') ?? undefined,
    page: searchParams.get('page') ? Number(searchParams.get('page')) : 1,
    limit: searchParams.get('limit') ? Number(searchParams.get('limit')) : 500,
  };

  return PreErpReconciliationService.listBalances(queryParams);
}, {
    permissions: [RBAC_PERMISSIONS.INVENTORY_READ],
  rawResponse: true,
});

export const POST = apiHandler(async (_req, params, body) => {
  const userId = params._userId;
  if (!userId) throw AppError.unauthorized('Authentication required');

  if (Array.isArray((body as { items?: unknown[] }).items)) {
    const bulkBody = BulkBalanceSchema.parse(body);
    for (const opmcId of new Set(bulkBody.items.map((item) => item.opmcId))) {
      await assertOpmcAccess(opmcId, userId);
    }
    const inputs = bulkBody.items.map((item) => ({
      ...item,
      opmcId: item.opmcId,
      createdById: userId,
    }));
    const result = await PreErpReconciliationService.bulkUpsertMonthBalances(inputs);
    return { success: true, ...result };
  } else {
    const singleBody = SingleBalanceSchema.parse(body);
    await assertOpmcAccess(singleBody.opmcId, userId);
    const result = await PreErpReconciliationService.upsertManualBalance({
      ...singleBody,
      opmcId: singleBody.opmcId,
      createdById: userId,
    });
    return { success: true, data: result };
  }
}, {
  schema: z.union([BulkBalanceSchema, SingleBalanceSchema]),
  permissions: [RBAC_PERMISSIONS.INVENTORY_WRITE],
  audit: { action: 'UPSERT', entity: 'PRE_ERP_MATERIAL_BALANCE' },
  rawResponse: true,
});
