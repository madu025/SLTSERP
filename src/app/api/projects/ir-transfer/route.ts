export const dynamic = 'force-dynamic';
import { ROLE_GROUPS } from '@/config/roles';
import { apiHandler } from '@/lib/api-handler';
import { ProjectIRLedgerService } from '@/services/project/project-ir-ledger.service';

// POST: Record a project-to-project material transfer
export const POST = apiHandler(async (req, _params, body) => {
  const userId = req.headers.get('x-user-id') || 'SYSTEM';

  const result = await ProjectIRLedgerService.recordProjectTransfer({
    ...(body as any),
    userId
  });
  return result;
}, {
  roles: ROLE_GROUPS.PROJECT_MANAGERS,
  audit: { action: 'CREATE', entity: 'STOCK_MOVEMENT' }
});
