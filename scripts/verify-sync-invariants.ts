/**
 * SOD sync invariants - the deploy gate for the sync rewrite.
 *
 * Read-only assertions against live data, so "it looks fine in the UI" is never the evidence:
 *   1. no SOD carries two history rows for the same status on the same Sri Lanka calendar day
 *      (the O3 census: 3,056 inflated rows/day);
 *   2. no status rank decrease is recorded in history (the O1 oscillation - RETURN, DISAPPEARED and
 *      the PAT rejection band are side bands, so they are excluded by design);
 *   3. every scheduled feed has a SyncRun row inside its own cadence + grace, and no row is left
 *      unfinished (a crashed pass would otherwise look like a healthy quiet window);
 *   4. SOD notification egress per hour stays under budget (the O2 flood: 1,910 rows for 91 SODs);
 *   5. the census itself is printed, because that table is what the logonly -> enforce decision is
 *      made from.
 *
 * Usage: npm run check:sync  [--hours=24] [--max-notifications=40]
 * Exit code is non-zero on any breach, so a pipeline can gate on it.
 *
 * SQL note: every statement here is assembled as a plain string and run through *RawUnsafe because
 * Prisma's tagged templates bind interpolations as parameters, which cannot carry a SQL fragment
 * (the rank CASE expression, the side-band list). Only validated numbers and literals are inlined.
 */

import 'dotenv/config';
import { primaryClient } from '../src/lib/prisma';
import { SOD_STATUS_RANK } from '../src/lib/constants/sod-status-policy';

/** Feeds the Master Tick must produce, and how often each one is due. */
const REQUIRED_FEEDS: Array<{ feed: string; cadenceMs: number }> = [
    { feed: 'RTOM_SWEEP', cadenceMs: 10 * 60 * 1000 },
    { feed: 'COMPLETED', cadenceMs: 20 * 60 * 1000 },
    { feed: 'PAT_HO_APPROVED', cadenceMs: 30 * 60 * 1000 },
    { feed: 'PAT_HO_REJECTED', cadenceMs: 30 * 60 * 1000 },
    { feed: 'RETURN', cadenceMs: 30 * 60 * 1000 },
];

/** A pass is late only after its cadence plus the grace a queued worker legitimately needs. */
const FRESHNESS_GRACE_MS = 5 * 60 * 1000;
/** SyncAuditService reclaims an unfinished row after 15 min; 30 min means the reclaim also failed. */
const ABANDONED_RUN_MS = 30 * 60 * 1000;

/**
 * Side bands: moving into or out of one is not a progress move, so an apparent rank decrease here
 * is expected (a RETURN that gets re-dispatched, a PAT rejection after INSTALL_CLOSED, a row the
 * live worklist stopped answering for) and must not fail the gate.
 */
const SIDE_BAND = ['RETURN', 'DISAPPEARED', 'PAT_OPMC_REJECTED', 'PAT_REJECTED'];

const arg = (name: string, fallback: number): number => {
    const hit = process.argv.find(a => a.startsWith(`--${name}=`));
    const value = Number(hit?.split('=')[1]);
    return Number.isFinite(value) && value > 0 ? value : fallback;
};

const windowOf = (hours: number): string => `${hours} * interval '1 hour'`;
const listOf = (values: string[]): string => values.map(v => `'${v}'`).join(',');

/** Same numbers the writer's policy uses, expressed once so SQL and code cannot drift apart. */
function rankCase(column: string): string {
    const whens = Object.entries(SOD_STATUS_RANK)
        .map(([status, rank]) => `WHEN ${column} = '${status}' THEN ${rank}`)
        .join(' ');
    return `CASE ${whens} ELSE NULL END`;
}

type Verdict = 'PASS' | 'FAIL' | 'INFO';
interface Check { name: string; verdict: Verdict; detail: string; }

const results: Check[] = [];

function record(name: string, breached: boolean, detail: string): void {
    results.push({ name, verdict: breached ? 'FAIL' : 'PASS', detail });
}

function info(name: string, detail: string): void {
    results.push({ name, verdict: 'INFO', detail });
}

async function checkDuplicateStatusDays(hours: number): Promise<void> {
    const rows = await primaryClient.$queryRawUnsafe<Array<{ groups: bigint; rows: bigint }>>(`
        WITH dup AS (
            SELECT "serviceOrderId", status,
                   date_trunc('day', "statusDate" + interval '5 hours 30 minutes') AS sl_day,
                   count(*) AS n
            FROM "ServiceOrderStatusHistory"
            WHERE "createdAt" >= now() - ${windowOf(hours)}
            GROUP BY 1, 2, 3
            HAVING count(*) > 1
        )
        SELECT count(*) AS groups, coalesce(sum(n), 0) AS rows FROM dup`);

    const groups = Number(rows[0]?.groups ?? 0);
    const total = Number(rows[0]?.rows ?? 0);
    record('one history row per (SOD, status, SL day)', groups > 0, groups === 0
        ? `no duplicated (SOD, status, day) groups in the last ${hours}h`
        : `${groups} group(s) covering ${total} row(s), e.g. one SOD marked COMPLETED twice in a day`);
}

async function checkRankDecreases(hours: number): Promise<void> {
    const sideBand = listOf(SIDE_BAND);
    const rows = await primaryClient.$queryRawUnsafe<Array<{ serviceOrderId: string; prev: string; status: string; at: Date }>>(`
        WITH seq AS (
            SELECT "serviceOrderId", status::text AS status,
                   LAG(status::text) OVER (PARTITION BY "serviceOrderId" ORDER BY "createdAt", "id") AS prev_status,
                   "createdAt"
            FROM "ServiceOrderStatusHistory"
            WHERE "createdAt" >= now() - ${windowOf(hours)}
        )
        SELECT "serviceOrderId", prev_status AS prev, status, "createdAt" AS at
        FROM seq
        WHERE prev_status IS NOT NULL
          AND ${rankCase('prev_status')} IS NOT NULL
          AND ${rankCase('status')} IS NOT NULL
          AND ${rankCase('status')} < ${rankCase('prev_status')}
          AND status NOT IN (${sideBand})
          AND prev_status NOT IN (${sideBand})
        ORDER BY "createdAt" DESC
        LIMIT 10`);

    record('no rank decrease in status history', rows.length > 0, rows.length === 0
        ? `forward-only held in the last ${hours}h`
        : rows.map(r => `${r.prev} -> ${r.status} on ${r.serviceOrderId} @ ${new Date(r.at).toISOString()}`).join('; '));
}

async function checkFeedFreshness(): Promise<void> {
    const latest = await primaryClient.$queryRawUnsafe<Array<{ feed: string; last_start: Date; runs: bigint }>>(`
        SELECT feed, max("startedAt") AS last_start, count(*) AS runs
        FROM "SyncRun"
        WHERE "startedAt" >= now() - interval '6 hours'
        GROUP BY feed`);
    const byFeed = new Map(latest.map(r => [r.feed, r]));

    const stale: string[] = [];
    for (const { feed, cadenceMs } of REQUIRED_FEEDS) {
        const row = byFeed.get(feed);
        const cadenceMin = Math.round(cadenceMs / 60000);
        if (!row) {
            stale.push(`${feed}: no run in 6h (due every ${cadenceMin}m)`);
            continue;
        }
        const ageMin = Math.round((Date.now() - new Date(row.last_start).getTime()) / 60000);
        if (ageMin * 60000 > cadenceMs + FRESHNESS_GRACE_MS) {
            stale.push(`${feed}: last run ${ageMin}m ago (due every ${cadenceMin}m)`);
        }
    }

    record('every scheduled feed has a recent SyncRun row', stale.length > 0, stale.length === 0
        ? `${REQUIRED_FEEDS.length} feeds seen inside cadence + ${FRESHNESS_GRACE_MS / 60000}m grace`
        : stale.join('; '));

    info('SyncRun rows by feed (last 6h)', byFeed.size
        ? [...byFeed.entries()].map(([f, r]) => `${f}=${Number(r.runs)}`).join(' ')
        : 'none - the census is not wired yet, or the worker is not draining');

    const abandoned = await primaryClient.$queryRawUnsafe<Array<{ n: bigint }>>(`
        SELECT count(*) AS n FROM "SyncRun"
        WHERE "finishedAt" IS NULL AND "startedAt" < now() - ${ABANDONED_RUN_MS} * interval '1 millisecond'`);
    const abandonedCount = Number(abandoned[0]?.n ?? 0);
    record('no abandoned (unfinished) run rows', abandonedCount > 0, abandonedCount === 0
        ? 'no row stuck open past the stale-reclaim bound'
        : `${abandonedCount} row(s) open for over ${ABANDONED_RUN_MS / 60000}m - a process died mid-pass and the reclaim did not run`);
}

async function checkNotificationRate(maxPerHour: number): Promise<void> {
    const rows = await primaryClient.$queryRawUnsafe<Array<{ n: bigint }>>(`
        SELECT count(*) AS n FROM "Notification"
        WHERE "createdAt" >= now() - interval '1 hour'
          AND ("title" LIKE 'Service Order Completed%'
            OR "title" LIKE 'Service Orders %'
            OR "title" LIKE 'New Service Orders Synced%'
            OR "title" LIKE 'SOD Returned%')`);
    const n = Number(rows[0]?.n ?? 0);
    record('SOD notification egress under budget', n > maxPerHour,
        `${n} row(s) in the last hour (budget ${maxPerHour})`);
}

async function reportCensus(hours: number): Promise<void> {
    const totals = await primaryClient.$queryRawUnsafe<Array<{
        mode: string; runs: bigint; fetched: bigint; created: bigint; updated: bigint;
        skipped: bigint; blocked: bigint; errored: bigint;
    }>>(`
        SELECT mode,
               count(*) AS runs,
               sum(fetched) AS fetched,
               sum(created) AS created,
               sum(updated) AS updated,
               sum("skippedNoChange") AS skipped,
               sum("blockedByPolicy") AS blocked,
               count(*) FILTER (
                   WHERE coalesce(jsonb_typeof(errors), '') <> 'array' OR jsonb_array_length(errors) > 0
               ) AS errored
        FROM "SyncRun"
        WHERE "startedAt" >= now() - ${windowOf(hours)}
        GROUP BY mode ORDER BY mode`);

    if (totals.length === 0) {
        info(`census (last ${hours}h)`, 'no SyncRun rows');
        return;
    }
    info(`census (last ${hours}h)`, totals.map(t =>
        `[${t.mode}] runs=${Number(t.runs)} fetched=${Number(t.fetched)} created=${Number(t.created)} ` +
        `updated=${Number(t.updated)} noChange=${Number(t.skipped)} blocked=${Number(t.blocked)} withErrors=${Number(t.errored)}`
    ).join(' | '));

    const decisions = await primaryClient.$queryRawUnsafe<Array<{ verdict: string; n: bigint }>>(`
        SELECT d.key AS verdict, sum((d.value)::int) AS n
        FROM "SyncRun" s
        CROSS JOIN LATERAL jsonb_each_text(
            CASE WHEN jsonb_typeof(s.decisions) = 'object' THEN s.decisions ELSE '{}'::jsonb END
        ) AS d
        WHERE s."startedAt" >= now() - ${windowOf(hours)}
        GROUP BY d.key ORDER BY n DESC LIMIT 20`);
    info('status-write verdicts', decisions.length
        ? decisions.map(d => `${d.verdict}=${Number(d.n)}`).join(' ')
        : 'none recorded (no status column moved)');
}

async function main(): Promise<void> {
    const hours = arg('hours', 24);
    const maxNotifications = arg('max-notifications', 40);

    await checkDuplicateStatusDays(hours);
    await checkRankDecreases(hours);
    await checkFeedFreshness();
    await checkNotificationRate(maxNotifications);
    await reportCensus(hours);

    for (const r of results) {
        console.log(`${r.verdict.padEnd(4)} ${r.name}: ${r.detail}`);
    }

    const failed = results.filter(r => r.verdict === 'FAIL');
    console.log(failed.length
        ? `\n${failed.length} invariant(s) breached.`
        : `\nAll invariants hold (window ${hours}h).`);

    if (failed.length > 0) process.exitCode = 1;
}

main()
    .catch((err: unknown) => {
        console.error('[check:sync] the assertions themselves failed:', err);
        process.exitCode = 1;
    })
    .finally(() => primaryClient.$disconnect());
