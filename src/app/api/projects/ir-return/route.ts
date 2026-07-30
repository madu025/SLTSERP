import { apiHandler } from '@/lib/api-handler';
import { ROLE_GROUPS } from '@/config/roles';
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
export const POST = apiHandler(async (req, _params, body) => {
  const userId = req.headers.get('x-user-id') || 'SYSTEM';
  const { transactionType, ...rest } = body as unknown as IRTransactionBody;
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
  roles: ROLE_GROUPS.PROJECT_MANAGERS,
  audit: { action: 'CREATE', entity: 'STOCK_MOVEMENT' }
});
