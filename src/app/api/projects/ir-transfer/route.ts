import { apiHandler } from '@/lib/api-handler';
import { ProjectIRLedgerService } from '@/services/project-ir-ledger.service';

// POST: Record a project-to-project material transfer
export const POST = apiHandler(async (req, _params, body) => {
  const userId = req.headers.get('x-user-id') || 'SYSTEM';

  const result = await ProjectIRLedgerService.recordProjectTransfer({
    ...body,
    userId
  });
  return result;
}, {
  roles: ['STORES_MANAGER', 'ENGINEER', 'OSP_MANAGER', 'ADMIN', 'SUPER_ADMIN'],
  audit: { action: 'CREATE', entity: 'STOCK_MOVEMENT' }
});
