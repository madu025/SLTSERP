import { apiHandler } from '@/lib/api-handler';
import { AppError } from '@/lib/error';
import { LedgerReportService, comparisonRange, type CompareMode } from '@/services/finance/ledger-report.service';

export const dynamic = 'force-dynamic';

// GET /api/finance/reports/cashflow?from=&to=&compare=previous|yoy
// With compare, `comparison` holds the same report for the equivalent earlier window (needs both from and to).
export const GET = apiHandler(async (req) => {
    const { searchParams } = new URL(req.url);
    const fromStr = searchParams.get('from');
    const toStr = searchParams.get('to');
    const compare = searchParams.get('compare');

    const fromDate = fromStr ? new Date(fromStr) : undefined;
    const toDate = toStr ? new Date(toStr) : undefined;
    if ((fromDate && Number.isNaN(fromDate.getTime())) || (toDate && Number.isNaN(toDate.getTime()))) {
        throw AppError.badRequest('from/to must be valid dates');
    }

    const report = await LedgerReportService.getCashFlowReport(fromDate, toDate);
    if (compare !== 'previous' && compare !== 'yoy') return report;
    if (!fromDate || !toDate) throw AppError.badRequest('compare needs both from and to');

    const range = comparisonRange(fromDate, toDate, compare as CompareMode);
    const comparison = await LedgerReportService.getCashFlowReport(range.from, range.to);
    return { ...report, comparison, comparisonMode: compare };
}, {
});
