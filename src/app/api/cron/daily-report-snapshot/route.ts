export const dynamic = "force-dynamic";
export const maxDuration = 300;

import { apiHandler } from "@/lib/api-handler";
import { ReportService } from "@/services/core/report.service";
import { assertCronAuth } from "@/lib/cron-auth";

/** GET /api/cron/daily-report-snapshot — freezes the report for the SL day that just ended (00:15 SL, Vercel Cron). */
export const GET = apiHandler(async (req) => {
    assertCronAuth(req);

    const SL_OFFSET_MS = 5.5 * 60 * 60 * 1000;
    const slDateKey = (d: Date): string =>
        new Date(d.getTime() + SL_OFFSET_MS).toISOString().split('T')[0];
    const targetDate = slDateKey(new Date(Date.now() - 24 * 60 * 60 * 1000));

    console.log(`[CRON] Freezing daily report snapshot for ${targetDate}...`);
    const startTime = Date.now();
    const rows = await ReportService.persistDailyReportSnapshot(targetDate);
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log(`[CRON] Daily report snapshot for ${targetDate} completed in ${duration}s (${rows} rows)`);
    return Response.json({
        success: true,
        date: targetDate,
        rows,
        duration: `${duration}s`,
        timestamp: new Date().toISOString(),
    });
});
