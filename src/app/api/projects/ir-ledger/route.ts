export const dynamic = 'force-dynamic';


import { apiHandler } from '@/lib/api-handler';
import { ProjectIRLedgerService } from '@/services/project-ir-ledger.service';

// GET: Fetch IR Ledger entries
export const GET = apiHandler(async (req) => {
  const { searchParams } = new URL(req.url);
  const history = searchParams.get('history') === 'true';
  const irNumber = searchParams.get('irNumber');
  if (history && irNumber) {
    return await ProjectIRLedgerService.getIRLedgerHistory(irNumber);
  }

  const projectId = searchParams.get('projectId') || undefined;
  const ledger = await ProjectIRLedgerService.getIRLedger(projectId);

  const meta = searchParams.get('meta') === 'true';
  if (meta) {
    const metaData = await ProjectIRLedgerService.getIRLedgerMeta();
    return {
      ledger,
      ...metaData
    };
  }

  return ledger;
});

// POST: Record an incoming SLT IR Receipt
export const POST = apiHandler(async (req, _params, body) => {
  const userId = req.headers.get('x-user-id') || 'SYSTEM';

  const result = await ProjectIRLedgerService.recordIRReceipt({
    ...(body as any),
    receivedById: userId
  });
  return result;
}, {
  roles: ['STORES_MANAGER', 'ADMIN', 'SUPER_ADMIN'],
  audit: { action: 'CREATE', entity: 'GRN' }
});
