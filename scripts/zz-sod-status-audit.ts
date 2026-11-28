import { config } from 'dotenv'; config({ path: '.env.local' });
/* eslint-disable @typescript-eslint/no-explicit-any */
// Read-only audit of SOD statuses after the portal sync (Pending -> Install Closed -> Completed). Runs every query inside a READ ONLY
// transaction, so nothing can be written. usage: pnpm exec tsx scripts/zz-sod-status-audit.ts
async function main() {
    const { prisma } = await import('../src/lib/prisma');
    const out: Record<string, unknown> = {};
    await prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
        const q = (sql: string) => tx.$queryRawUnsafe<any[]>(sql);
        out.readOnly = (await q(`SELECT current_setting('transaction_read_only') AS ro`))[0].ro;
        // 1. how the orders are spread (portal status x ERP status)
        out.matrix = await q(`SELECT "sltsStatus" AS slt, status, count(*)::int AS n FROM "ServiceOrder" GROUP BY 1,2 ORDER BY 3 DESC LIMIT 40`);
        // 2. portal says finished, ERP workflow still open (should be 0: the self-heal moves these)
        out.staleActiveUnderTerminal = await q(`SELECT "sltsStatus" AS slt, status, count(*)::int AS n, min("updatedAt") AS oldest FROM "ServiceOrder"
            WHERE "sltsStatus" IN ('INSTALL_CLOSED','COMPLETED','PAT_OPMC_PASSED','PAT_CORRECTED') AND status IN ('PENDING','INPROGRESS','ASSIGNED','PROV_CLOSED') GROUP BY 1,2`);
        // 3. finished without a completion date
        out.terminalNoCompletedDate = await q(`SELECT "sltsStatus" AS slt, count(*)::int AS n FROM "ServiceOrder" WHERE "sltsStatus" IN ('INSTALL_CLOSED','COMPLETED') AND "completedDate" IS NULL GROUP BY 1`);
        // 4. open orders with a completion date (half-completed)
        out.openWithCompletedDate = await q(`SELECT "sltsStatus" AS slt, count(*)::int AS n FROM "ServiceOrder" WHERE "sltsStatus" IN ('INPROGRESS','ASSIGNED','PENDING') AND "completedDate" IS NOT NULL GROUP BY 1`);
        // 5. flip-flop in the last 7 days: an order that went finished -> open -> finished again
        out.flipFlop7d = await q(`WITH h AS (SELECT "serviceOrderId" id, status, "createdAt", lag(status) OVER (PARTITION BY "serviceOrderId" ORDER BY "createdAt") prev FROM "ServiceOrderStatusHistory" WHERE "createdAt" > now() - interval '7 days')
            SELECT count(DISTINCT id)::int AS orders, count(*)::int AS reopen_rows FROM h WHERE prev IN ('INSTALL_CLOSED','COMPLETED') AND status IN ('INPROGRESS','ASSIGNED','PENDING','PROV_CLOSED')`);
        out.busiestHistory7d = await q(`SELECT so."soNum", so."sltsStatus" AS slt, count(*)::int AS changes, string_agg(h.status::text, '>' ORDER BY h."createdAt") AS path FROM "ServiceOrderStatusHistory" h JOIN "ServiceOrder" so ON so.id = h."serviceOrderId"
            WHERE h."createdAt" > now() - interval '7 days' GROUP BY 1,2 HAVING count(*) > 4 ORDER BY 3 DESC LIMIT 10`);
        // 6. open orders the sync has not touched for a long time (the portal may have closed them; nothing told us)
        out.openNotTouched = await q(`SELECT CASE WHEN "updatedAt" < now() - interval '30 days' THEN '>30d' WHEN "updatedAt" < now() - interval '7 days' THEN '7-30d' WHEN "updatedAt" < now() - interval '2 days' THEN '2-7d' ELSE '<2d' END AS idle,
            count(*)::int AS n FROM "ServiceOrder" WHERE "sltsStatus" IN ('INPROGRESS','ASSIGNED','PENDING') GROUP BY 1 ORDER BY 1`);
        out.openByAge = await q(`SELECT CASE WHEN coalesce("receivedDate","createdAt") < now() - interval '60 days' THEN '>60d' WHEN coalesce("receivedDate","createdAt") < now() - interval '30 days' THEN '30-60d' WHEN coalesce("receivedDate","createdAt") < now() - interval '7 days' THEN '7-30d' ELSE '<7d' END AS age,
            count(*)::int AS n FROM "ServiceOrder" WHERE "sltsStatus" IN ('INPROGRESS','ASSIGNED','PENDING') GROUP BY 1 ORDER BY 1`);
        // 7. sync runs: per feed, last run, failures and policy blocks in the last 24 h
        out.syncFeeds24h = await q(`SELECT feed, count(*)::int AS runs, max("startedAt") AS last_start, max("finishedAt") AS last_finish, count(*) FILTER (WHERE "finishedAt" IS NULL)::int AS unfinished,
            count(*) FILTER (WHERE jsonb_array_length(errors) > 0)::int AS with_errors, sum(fetched)::int AS fetched, sum(updated)::int AS updated, sum("blockedByPolicy")::int AS blocked, max(mode) AS mode
            FROM "SyncRun" WHERE "startedAt" > now() - interval '24 hours' GROUP BY 1 ORDER BY 1`);
        out.syncErrorsSample = await q(`SELECT feed, rtom, "startedAt", left(errors::text, 300) AS errors FROM "SyncRun" WHERE "startedAt" > now() - interval '24 hours' AND jsonb_array_length(errors) > 0 ORDER BY "startedAt" DESC LIMIT 6`);
        out.decisions24h = await q(`SELECT feed, d.key AS decision, sum((d.value)::text::int)::int AS n FROM "SyncRun", jsonb_each(decisions) d WHERE "startedAt" > now() - interval '24 hours' AND jsonb_typeof(d.value) = 'number' GROUP BY 1,2 ORDER BY 3 DESC LIMIT 25`);
        // 8. finished by the portal, but the ERP completion (materials) still not entered
        out.installClosedWithoutMaterials = await q(`SELECT count(*)::int AS n, count(*) FILTER (WHERE "completedDate" < now() - interval '7 days')::int AS older_7d FROM "ServiceOrder" so
            WHERE "sltsStatus" = 'INSTALL_CLOSED' AND NOT EXISTS (SELECT 1 FROM "SODMaterialUsage" m WHERE m."serviceOrderId" = so.id)`);
        out.finishedNoContractor = await q(`SELECT count(*)::int AS n FROM "ServiceOrder" WHERE "sltsStatus" IN ('INSTALL_CLOSED','COMPLETED') AND "contractorId" IS NULL AND "completedDate" > now() - interval '30 days'`);
    }, { timeout: 120_000 });
    console.log(JSON.stringify(out, null, 1));
    process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
