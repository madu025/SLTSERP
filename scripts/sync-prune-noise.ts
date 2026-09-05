/**
 * One-off collapse of status-history noise (Section 7.2).
 *
 * The pre-rewrite sweep re-asserted the same status on every tick and each assertion wrote a
 * `ServiceOrderStatusHistory` row, which inflated the report counters (measured 3,056 rows/day).
 * The writer now suppresses a same-status re-assertion, so no NEW noise is produced - this cleans
 * the rows the old code already left behind.
 *
 * Archive-first, never a bare delete: every doomed row is copied into `_SyncNoiseArchive` with the
 * run stamp inside the same transaction that removes it, so the repair is reversible
 * (`INSERT INTO "ServiceOrderStatusHistory" SELECT id, "serviceOrderId", status, "statusDate",
 * "createdAt" FROM "_SyncNoiseArchive" WHERE "archivedByRun" = '<stamp>'` restores a run).
 *
 * Keep rule: one row per (serviceOrderId, status, Sri Lanka calendar day) - the EARLIEST, because
 * that is the row whose `createdAt` is closest to when the ERP first observed the move.
 *
 * Usage: npx tsx scripts/sync-prune-noise.ts [--apply] [--hours=168]
 *   without --apply = dry run, reports the count and writes nothing.
 */

import 'dotenv/config';
import { primaryClient } from '../src/lib/prisma';

const apply = process.argv.includes('--apply');
const hoursArg = Number(process.argv.find(a => a.startsWith('--hours='))?.split('=')[1]);
const windowHours = Number.isFinite(hoursArg) && hoursArg > 0 ? hoursArg : 168;
const runStamp = new Date().toISOString();

/**
 * The earliest row of a row's own (SOD, status, SL day) group. A row is noise when this id is not
 * itself. Correlated, so it also handles a group of one (its own id, hence kept).
 */
const KEEP_ID = `
    (SELECT keep.id
     FROM "ServiceOrderStatusHistory" keep
     WHERE keep."serviceOrderId" = h."serviceOrderId"
       AND keep.status = h.status
       AND date_trunc('day', keep."statusDate" + interval '5 hours 30 minutes')
           = date_trunc('day', h."statusDate" + interval '5 hours 30 minutes')
     ORDER BY keep."createdAt" ASC, keep."id" ASC
     LIMIT 1)`;

const NOISY = `
    FROM "ServiceOrderStatusHistory" h
    WHERE h."createdAt" >= now() - (${windowHours} * interval '1 hour')
      AND h.id <> ${KEEP_ID}`;

// Built as plain strings with positional bindings instead of tagged templates because the shared
// fragment above cannot be expressed through `Prisma.raw` in Prisma 6. `windowHours` is the only
// value interpolated into SQL text and it is validated finite above; everything else binds.
const COUNT_SQL = `SELECT count(*) AS noisy, count(DISTINCT h."serviceOrderId") AS sods ${NOISY}`;
const INSERT_SQL = `
    INSERT INTO "_SyncNoiseArchive" (id, "serviceOrderId", status, "statusDate", "createdAt", "archivedByRun")
    SELECT h.id, h."serviceOrderId", h.status::text, h."statusDate", h."createdAt", $1
    ${NOISY}`;
const DELETE_SQL = `
    DELETE FROM "ServiceOrderStatusHistory" h
    WHERE EXISTS (
        SELECT 1 FROM "_SyncNoiseArchive" a
        WHERE a.id = h.id AND a."archivedByRun" = $1
    )`;

async function main(): Promise<void> {
    const counted = await primaryClient.$queryRawUnsafe<Array<{ noisy: bigint; sods: bigint }>>(COUNT_SQL);

    const noisy = Number(counted[0]?.noisy ?? 0);
    const sods = Number(counted[0]?.sods ?? 0);
    console.log(`Window: last ${windowHours}h. Duplicate history rows: ${noisy} across ${sods} SOD(s).`);

    if (noisy === 0) {
        console.log('Nothing to prune - history already carries one row per (SOD, status, SL day).');
        return;
    }
    if (!apply) {
        console.log('DRY RUN (pass --apply to archive and delete).');
        return;
    }

    // The archive is only created by an applying run: a dry run must leave no trace at all, not even DDL.
    await primaryClient.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "_SyncNoiseArchive" (
            id              uuid        NOT NULL,
            "serviceOrderId" uuid       NOT NULL,
            status          text        NOT NULL,
            "statusDate"    timestamptz NOT NULL,
            "createdAt"     timestamptz NOT NULL,
            "archivedAt"    timestamptz NOT NULL DEFAULT now(),
            "archivedByRun" text        NOT NULL,
            CONSTRAINT "_SyncNoiseArchive_pkey" PRIMARY KEY (id, "archivedByRun")
        )`);

    // One transaction: a half-finished prune (archived but not deleted, or the reverse) is the one
    // outcome that would make the repair unrunnable.
    const [archived, deleted] = await primaryClient.$transaction([
        primaryClient.$executeRawUnsafe(INSERT_SQL, runStamp),
        primaryClient.$executeRawUnsafe(DELETE_SQL, runStamp),
    ]);

    console.log(`Archived ${archived} row(s) under run ${runStamp}, deleted ${deleted}.`);
    if (archived !== deleted) {
        // Cannot happen while both statements share the predicate, but the mismatch would mean the
        // archive and the live table disagree, so say it out loud rather than leave it silent.
        console.warn(`[sync-prune-noise] archived=${archived} but deleted=${deleted} - inspect before re-running.`);
        process.exitCode = 1;
    }
}

main()
    .catch((err: unknown) => {
        console.error('[sync-prune-noise] failed:', err);
        process.exitCode = 1;
    })
    .finally(() => primaryClient.$disconnect());
