import { apiHandler } from '@/lib/api-handler';
import { ReportService } from '@/services/core/report.service';
import { z } from 'zod';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { resolveReportScope, normalizeRtom } from '@/lib/report-scope';

export const dynamic = 'force-dynamic';

const querySchema = z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
});

export const GET = apiHandler(async (request, params) => {
    const { searchParams } = new URL(request.url);
    const parsed = querySchema.safeParse({
        date: searchParams.get('date'),
    });

    if (!parsed.success) {
        return { success: false, error: 'Invalid query parameters', details: parsed.error.format() };
    }

    const result = await ReportService.getDailyOperationalReport({ date: parsed.data.date });
    // An Area Manager's report holds their own RTOMs only: the rows, the pipeline and its grand total are cut to them.
    const scope = await resolveReportScope(params._userId);
    if (!scope) return result;
    const mine = (rtom: string | undefined) => !!rtom && scope.normalized.has(normalizeRtom(rtom));
    const pipeline = result.monthlyPipeline.filter((r) => mine(r.rtom));
    const sum = (k: 'monthInstallClosed' | 'completed' | 'opmcPatPassed' | 'finalPatPassed' | 'patRejected' | 'pendingFinalPat' | 'sameDayCompleted' | 'intakeSameDayCompleted' | 'backlogSameDayCompleted') => pipeline.reduce((a, r) => a + r[k], 0);
    const grand = {
        monthInstallClosed: sum('monthInstallClosed'), completed: sum('completed'), opmcPatPassed: sum('opmcPatPassed'), finalPatPassed: sum('finalPatPassed'), patRejected: sum('patRejected'), pendingFinalPat: sum('pendingFinalPat'),
        sameDayCompleted: sum('sameDayCompleted'), intakeSameDayCompleted: sum('intakeSameDayCompleted'), backlogSameDayCompleted: sum('backlogSameDayCompleted'), sameDayRate: 0, finalPatConversionRate: 0,
    };
    grand.sameDayRate = grand.monthInstallClosed > 0 ? Math.round((grand.sameDayCompleted / grand.monthInstallClosed) * 1000) / 10 : 0;
    grand.finalPatConversionRate = grand.monthInstallClosed > 0 ? Math.round((grand.finalPatPassed / grand.monthInstallClosed) * 1000) / 10 : 0;
    return { ...result, reportData: result.reportData.filter((r) => mine((r as { rtom?: string }).rtom)), monthlyPipeline: pipeline, monthlyPipelineGrandTotal: grand };
}, { rawResponse: true, permissions: [RBAC_PERMISSIONS.REPORTS_READ] });
