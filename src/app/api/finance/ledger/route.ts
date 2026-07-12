import { apiHandler } from '@/lib/api-handler';
import { LedgerService } from '@/services/finance/ledger.service';

export const dynamic = 'force-dynamic';

// GET /api/finance/ledger - List general ledger entries paginated (roles guarded)
export const GET = apiHandler(async (req) => {
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    return await LedgerService.getLedgerEntries({ page, limit });
}, {
    roles: ['FINANCE_MANAGER', 'SUPER_ADMIN'],
    rawResponse: true
});
