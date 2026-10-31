export const dynamic = 'force-dynamic';


import { apiHandler } from '@/lib/api-handler';
import { ProjectIRLedgerService } from '@/services/project/project-ir-ledger.service';
import { assertProjectAccess } from '@/lib/project-access';
import { getAccessibleProjectIds, requireUserId } from '@/lib/project-record-access';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { StoreService } from '@/services/inventory/store.service';
import { z } from 'zod';

const PROJECT_MOVEMENT_TYPES = new Set(['PROJECT_ISSUE', 'PROJECT_RETURN', 'PROJECT_TRANSFER_OUT', 'PROJECT_TRANSFER_IN', 'WASTAGE', 'SLT_RETURN']);
const receiptSchema = z.object({
  irNumber: z.string().min(1),
  storeId: z.string().uuid(),
  items: z.array(z.object({ itemId: z.string().uuid(), quantity: z.number().positive() })).min(1),
});

// GET: Fetch IR Ledger entries
export const GET = apiHandler(async (req, params) => {
  const userId = requireUserId(params._userId);
  const accessible = await getAccessibleProjectIds(userId);
  const stores = await StoreService.getAccessibleStores(userId, '');
  const storeIds = stores.map(store => store.id);
  const { searchParams } = new URL(req.url);
  const history = searchParams.get('history') === 'true';
  const irNumber = searchParams.get('irNumber');
  if (history && irNumber) {
    const history = await ProjectIRLedgerService.getIRLedgerHistory(irNumber, storeIds);
    // Project movements need project scope; receipts remain limited by store scope.
    return accessible === undefined
      ? history
      : history.filter((h) => !PROJECT_MOVEMENT_TYPES.has(h.type) || !h.referenceId || accessible.has(h.referenceId));
  }

  const projectId = searchParams.get('projectId') || undefined;
  if (projectId) await assertProjectAccess(projectId, params._userId);
  const fullLedger = await ProjectIRLedgerService.getIRLedger(projectId, projectId ? undefined : storeIds);
  const ledger = accessible === undefined || projectId
    ? fullLedger
    : fullLedger.filter((e) => !e.projectId || accessible.has(e.projectId));

  const meta = searchParams.get('meta') === 'true';
  if (meta) {
    const metaData = await ProjectIRLedgerService.getIRLedgerMeta(storeIds, accessible === undefined ? undefined : [...accessible]);
    return {
      ledger,
      ...metaData
    };
  }

  return ledger;
}, { permissions: [RBAC_PERMISSIONS.INVENTORY_READ] });

// POST: Record an incoming SLT IR Receipt
export const POST = apiHandler(async (_req, params, body) => {
  const userId = requireUserId(params._userId);
  const { storeId, ...receipt } = receiptSchema.parse(body);
  await StoreService.assertStoreWriteAccess(userId, storeId);

  const result = await ProjectIRLedgerService.recordIRReceipt({
    ...receipt,
    storeId,
    receivedById: userId
  });
  return result;
}, {
  permissions: [RBAC_PERMISSIONS.INVENTORY_WRITE],
  audit: { action: 'CREATE', entity: 'GRN' }
});
