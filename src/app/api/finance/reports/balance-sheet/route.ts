import { apiHandler } from '@/lib/api-handler';
import { AppError } from '@/lib/error';
import { LedgerReportService } from '@/services/finance/ledger-report.service';

export const dynamic = 'force-dynamic';

// GET /api/finance/reports/balance-sheet?asOf=&compareAsOf=
// With compareAsOf, `comparison` holds the balance sheet at that earlier date.
export const GET = apiHandler(async (req) => {
    const { searchParams } = new URL(req.url);
    const asOfStr = searchParams.get('asOf');
    const compareStr = searchParams.get('compareAsOf');
    const asOfDate = asOfStr ? new Date(asOfStr) : undefined;
    const compareDate = compareStr ? new Date(compareStr) : undefined;
    if ((asOfDate && Number.isNaN(asOfDate.getTime())) || (compareDate && Number.isNaN(compareDate.getTime()))) {
        throw AppError.badRequest('asOf/compareAsOf must be valid dates');
    }

    const report = await LedgerReportService.getBalanceSheetReport(asOfDate);
    if (!compareDate) return report;
    const comparison = await LedgerReportService.getBalanceSheetReport(compareDate);
    return { ...report, comparison };
}, {
});
