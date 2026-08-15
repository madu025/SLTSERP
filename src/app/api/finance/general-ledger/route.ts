import { ROLE_GROUPS } from '@/config/roles';
import { apiHandler } from '@/lib/api-handler';
import { LedgerService } from '@/services/finance/ledger.service';
export const dynamic = 'force-dynamic';
export const GET = apiHandler(async () => {
  const data = await LedgerService.getLedgerEntries({ limit: 100 });
  return data.items;
}, {
  roles: ROLE_GROUPS.FINANCE_APPROVERS
});