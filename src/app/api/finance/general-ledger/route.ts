import { NextResponse } from 'next/server';
import { apiHandler } from '@/lib/api-handler';
import { LedgerService } from '@/services/finance/ledger.service';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async () => {
  const data = await LedgerService.getLedgerEntries({ limit: 100 });
  return data.items;
}, {
  roles: ['SUPER_ADMIN', 'ADMIN', 'FINANCE_MANAGER']
});
