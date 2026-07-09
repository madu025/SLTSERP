import { apiHandler } from '@/lib/api-handler';
import { ProjectIRLedgerService } from '@/services/project-ir-ledger.service';

// POST: Record material issues or returns
export const POST = apiHandler(async (req, _params, body) => {
  const userId = req.headers.get('x-user-id') || 'SYSTEM';
  const { transactionType, ...rest } = body;

  if (transactionType === 'PROJECT_ISSUE') {
    return await ProjectIRLedgerService.recordProjectIssue({
      ...rest,
      userId
    });
  } else if (transactionType === 'SLT_RETURN') {
    return await ProjectIRLedgerService.recordSLTReturn({
      ...rest,
      userId
    });
  } else {
    // Default to PROJECT_RETURN
    return await ProjectIRLedgerService.recordProjectReturn({
      ...rest,
      userId
    });
  }
}, {
  roles: ['STORES_MANAGER', 'ENGINEER', 'OSP_MANAGER', 'ADMIN', 'SUPER_ADMIN'],
  audit: { action: 'CREATE', entity: 'STOCK_MOVEMENT' }
});
