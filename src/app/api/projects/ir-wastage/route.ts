import { apiHandler } from '@/lib/api-handler';
import { ProjectIRLedgerService } from '@/services/project-ir-ledger.service';

// POST: Record project material wastage
export const POST = apiHandler(async (req, _params, body) => {
  const userId = req.headers.get('x-user-id') || 'SYSTEM';

  const result = await ProjectIRLedgerService.recordWastage({
    ...body,
    userId
  });
  return result;
}, {
  roles: ['ENGINEER', 'OSP_MANAGER', 'STORES_MANAGER', 'ADMIN', 'SUPER_ADMIN'],
  audit: { action: 'CREATE', entity: 'WASTAGE' }
});
