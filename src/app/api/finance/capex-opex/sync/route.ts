import { apiHandler } from '@/lib/api-handler';
import { AppError } from '@/lib/error';
import { CapexOpexLedgerService } from '@/services/finance/capex-opex-ledger.service';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

// Only ADMIN can trigger bulk sync (one-time historical backfill)
const SyncSchema = z.object({
  opmcId: z.string().min(1),
  projectIds: z.array(z.string()).min(1).max(500),
});

export const POST = apiHandler(async (_req, _params, body) => {
  const userId = _req.headers.get('x-user-id');
  if (!userId) throw AppError.unauthorized('Authentication required');

  const result = await CapexOpexLedgerService.bulkSyncFromProjectExpenses(
    body.opmcId,
    body.projectIds,
    userId
  );

  return {
    success: true,
    synced: result.synced,
    skipped: result.skipped,
    message: `Synced ${result.synced} entries, skipped ${result.skipped} already-synced records.`,
  };
}, {
  schema: SyncSchema,
  roles: ['SUPER_ADMIN', 'ADMIN'],
  audit: { action: 'SYNC', entity: 'CAPEX_OPEX_LEDGER' },
  rawResponse: true,
});
