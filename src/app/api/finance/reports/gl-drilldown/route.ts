import { apiHandler } from '@/lib/api-handler';
import { LedgerService } from '@/services/finance/ledger.service';
import { AppError } from '@/lib/error';
import { ROLE_GROUPS } from "@/config/roles";

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async (req) => {
    const { searchParams } = new URL(req.url);
    const accountCode = searchParams.get('accountCode');
    const fromStr = searchParams.get('from');
    const toStr = searchParams.get('to');

    if (!accountCode) {
        throw AppError.badRequest('Query parameter accountCode is required');
    }

    const fromDate = fromStr ? new Date(fromStr) : undefined;
    const toDate = toStr ? new Date(toStr) : undefined;

    return await LedgerService.getGlDrilldown(accountCode, fromDate, toDate);
}, {
    roles: ROLE_GROUPS.FINANCE_ALL
});
