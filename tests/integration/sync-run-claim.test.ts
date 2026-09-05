/**
 * Census claim test (plan Section 8), opt-in because it needs the unique index to be real.
 *
 * The claim is the only thing standing between one Master Tick and four concurrent executions of the
 * same window, so it is also the one place where a mistake stops the entire sync rather than corrupt
 * a row. Shipped code did exactly that on 2026-09-05: an `upsert` claim cannot tell "I inserted this"
 * from "someone else inserted this", fell through to its own age test, and every pass refused itself
 * as IN_FLIGHT (129 windows claimed, 129 refused, zero sweeps executed). These four states are what
 * the fix has to keep distinct.
 *
 *   $env:SYNC_INTEGRATION_DB='1'; npm run test:integration
 */

import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

import { primaryClient } from '../../src/lib/prisma';
import { SyncAuditService } from '../../src/services/service-order/sync/sync-audit.service';

const enabled = process.env.SYNC_INTEGRATION_DB === '1';

/** A window far in the past, so no real feed can collide with these rows. */
const WINDOW = { start: new Date('2000-01-01T00:00:00.000Z'), end: null };
const RTOM = 'ZZ-CLAIMTEST';

const ownRows = () => primaryClient.syncRun.findMany({
    where: { feed: 'RTOM_SWEEP', rtom: RTOM },
    select: { id: true, windowKey: true, fetched: true, finishedAt: true },
});

const claim = () => SyncAuditService.startRun({ feed: 'RTOM_SWEEP', rtom: RTOM, window: WINDOW });

describe('SyncAuditService window claim', { skip: enabled ? false : 'set SYNC_INTEGRATION_DB=1' }, () => {
    before(async () => {
        await primaryClient.syncRun.deleteMany({ where: { feed: 'RTOM_SWEEP', rtom: RTOM } });
    });

    after(async () => {
        await primaryClient.syncRun.deleteMany({ where: { feed: 'RTOM_SWEEP', rtom: RTOM } });
        await primaryClient.$disconnect();
    });

    it('a fresh window is STARTED, not refused as its own in-flight pass', async () => {
        const first = await claim();
        assert.equal(first.state, 'STARTED', `first claim got ${first.state} - the self-refusal bug`);
        assert.ok(first.runId, 'a claimed window must return the row that owns it');

        const rows = await ownRows();
        assert.equal(rows.length, 1);
        assert.equal(rows[0].finishedAt, null, 'a claimed-but-unfinished window stays open');
    });

    it('the same window claimed again is IN_FLIGHT', async () => {
        const again = await claim();
        assert.equal(again.state, 'IN_FLIGHT');
    });

    it('an unfinished window aged past the stale bound is reclaimed, and its counters land', async () => {
        const [open] = await ownRows();
        assert.ok(open, 'the previous tests must have left exactly one open row');
        await primaryClient.syncRun.update({
            where: { id: open.id },
            data: { startedAt: new Date(Date.now() - 20 * 60 * 1000) },
        });

        const reclaimed = await claim();
        assert.equal(reclaimed.state, 'STARTED', 'a crashed pass must be reclaimable, or the feed deadlocks');
        assert.equal(reclaimed.runId, open.id, 'the reclaim reuses the census row instead of adding one');

        await SyncAuditService.finishRun(reclaimed.runId, {
            counters: { fetched: 12, created: 2, updated: 3, skippedNoChange: 7, blockedByPolicy: 0 },
            decisions: { APPLIED: 5, NO_CHANGE: 7 },
        });

        const [row] = await ownRows();
        assert.ok(row.finishedAt, 'a finished pass must carry finishedAt');
        const stored = await primaryClient.syncRun.findUniqueOrThrow({
            where: { id: open.id },
            select: { fetched: true, created: true, updated: true, skippedNoChange: true, decisions: true },
        });
        assert.deepEqual(
            { fetched: stored.fetched, created: stored.created, updated: stored.updated, skippedNoChange: stored.skippedNoChange },
            { fetched: 12, created: 2, updated: 3, skippedNoChange: 7 },
            'the counters are what the logonly to enforce decision is made from'
        );
        assert.deepEqual(stored.decisions, { APPLIED: 5, NO_CHANGE: 7 });
    });

    it('a completed window replayed is REPLAY, and the replay does not touch the row', async () => {
        const snapshot = await ownRows();
        const replay = await claim();
        assert.equal(replay.state, 'REPLAY');

        const afterRows = await ownRows();
        assert.deepEqual(afterRows[0], snapshot[0], 'a replay must leave the finished census row alone');
    });
});
