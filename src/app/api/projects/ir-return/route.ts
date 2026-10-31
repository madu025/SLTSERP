export const dynamic = 'force-dynamic';
import { apiHandler } from '@/lib/api-handler';
import { AppError } from '@/lib/error';
import { assertProjectAccess } from '@/lib/project-access';
import { requireUserId } from '@/lib/project-record-access';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { ProjectIRLedgerService } from '@/services/project/project-ir-ledger.service';

interface IRTransactionBody {
  transactionType: 'PROJECT_ISSUE' | 'SLT_RETURN' | 'PROJECT_RETURN';
  projectId: string;
  storeId: string;
  batchId: string;
  itemId: string;
  quantity: number;
  remarks?: string;
  contractorId?: string;
  gatepassNumber?: string;
}

// POST: Record material issues or returns
export const POST = apiHandler(async (_req, params, body) => {
  const userId = requireUserId(params._userId);
  const { transactionType, ...rest } = body as unknown as IRTransactionBody;
  if (!rest.projectId) throw AppError.badRequest('projectId is required');
  await assertProjectAccess(rest.projectId, userId);
  const payload = rest;

  if (transactionType === 'PROJECT_ISSUE') {
    return await ProjectIRLedgerService.recordProjectIssue({
      ...payload,
      userId
    });
  } else if (transactionType === 'SLT_RETURN') {
    return await ProjectIRLedgerService.recordSLTReturn({
      ...payload,
      userId,
      gatepassNumber: payload.gatepassNumber || ''
    });
  } else {
    // Default to PROJECT_RETURN
    return await ProjectIRLedgerService.recordProjectReturn({
      ...payload,
      userId
    });
  }
}, {
  permissions: [RBAC_PERMISSIONS.INVENTORY_WRITE],
  audit: { action: 'CREATE', entity: 'STOCK_MOVEMENT' }
});
