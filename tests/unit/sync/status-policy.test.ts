/**
 * Authority policy matrix for `decideStatusWrite` (plan Section 8, first bullet).
 *
 * The policy is a pure function, so every cell of rank x actor x anchor is assertable without a
 * database. Each case below is a move that production actually made before the rewrite; the measured
 * defects are named in the test titles so a future edit cannot silently reintroduce one.
 *
 * Run: npm run test:unit
 */

import assert from 'node:assert/strict';
import { after, describe, it } from 'node:test';

import {
    SOD_STATUS_RANK,
    decideStatusWrite,
    evaluateStatusWrite,
    syncStatusPolicyMode,
} from '../../../src/lib/constants/sod-status-policy';
import type { StatusWriteInput, SyncActor } from '../../../src/lib/constants/sod-status-policy';

const T0 = new Date('2026-09-01T00:00:00.000Z');
const HOUR = 60 * 60 * 1000;

/** Anchors default to "both unknown", which is the case where rule 5 cannot fire. */
function input(over: Partial<StatusWriteInput> & Pick<StatusWriteInput, 'current' | 'incoming' | 'actor'>): StatusWriteInput {
    return { incomingAnchor: null, storedAnchor: null, ...over };
}

const verdict = (over: Parameters<typeof input>[0]) => decideStatusWrite(input(over));

describe('SOD_STATUS_RANK', () => {
    it('orders the lifecycle the way the portal does', () => {
        assert.ok(SOD_STATUS_RANK.ASSIGNED < SOD_STATUS_RANK.INPROGRESS);
        assert.ok(SOD_STATUS_RANK.INPROGRESS < SOD_STATUS_RANK.PROV_CLOSED);
        assert.ok(SOD_STATUS_RANK.PROV_CLOSED < SOD_STATUS_RANK.COMPLETED);
        assert.ok(SOD_STATUS_RANK.COMPLETED < SOD_STATUS_RANK.INSTALL_CLOSED);
        assert.ok(SOD_STATUS_RANK.INSTALL_CLOSED < SOD_STATUS_RANK.PAT_OPMC_PASSED);
    });

    it('treats a rejected PAT as completed-but-failed-acceptance, above COMPLETED', () => {
        assert.ok(SOD_STATUS_RANK.PAT_REJECTED > SOD_STATUS_RANK.COMPLETED);
        assert.ok(SOD_STATUS_RANK.PAT_OPMC_REJECTED > SOD_STATUS_RANK.COMPLETED);
        // Same band, different feed: a lateral move between them is not a downgrade.
        assert.equal(SOD_STATUS_RANK.PAT_REJECTED, SOD_STATUS_RANK.PAT_OPMC_REJECTED);
    });

    it('parks RETURN between the working band and the closed band', () => {
        assert.ok(SOD_STATUS_RANK.RETURN > SOD_STATUS_RANK.PROV_CLOSED);
        assert.ok(SOD_STATUS_RANK.RETURN < SOD_STATUS_RANK.COMPLETED);
    });
});

describe('rule 2 - unknown portal strings never reach the column', () => {
    for (const raw of ['RETURNED', 'CANCELLED', 'RETURN_PENDING', 'FINISHED', 'PAT_PASSED', 'NONSENSE']) {
        it(`refuses "${raw}" as an incoming sltsStatus`, () => {
            const d = verdict({ current: 'ASSIGNED', incoming: raw, actor: 'PORTAL_SWEEP' });
            assert.equal(d.allow, false);
            assert.equal(d.reason, 'UNKNOWN_STATUS');
        });
    }

    it('refuses PENDING: it belongs to the workflow column, not sltsStatus', () => {
        assert.equal(verdict({ current: 'ASSIGNED', incoming: 'PENDING', actor: 'USER' }).reason, 'UNKNOWN_STATUS');
    });

    it('accepts the empty incoming that means "no status in this intent"', () => {
        // A field-only write (returnReason, completedDate) must pass the policy untouched. An empty
        // string is the same intent as null here, not an unknown portal value: the guard is on
        // `incoming &&`, so it never reaches rule 2.
        assert.equal(verdict({ current: 'COMPLETED', incoming: null, actor: 'PORTAL_RETURN' }).reason, 'APPLIED');
        assert.equal(verdict({ current: 'COMPLETED', incoming: '', actor: 'PORTAL_RETURN' }).reason, 'APPLIED');
    });
});

describe('rule 1 - NO_CHANGE is an optimization, not an authority refusal', () => {
    it('skips an identical status so updatedAt, history and notifications stay put', () => {
        const d = verdict({ current: 'INPROGRESS', incoming: 'INPROGRESS', actor: 'PORTAL_SWEEP' });
        assert.equal(d.allow, false);
        assert.equal(d.reason, 'NO_CHANGE');
    });

    it('is bypassed by forcesChange (already COMPLETED, but completedDate is still missing)', () => {
        assert.equal(verdict({ current: 'COMPLETED', incoming: 'COMPLETED', actor: 'PORTAL_COMPLETED', forcesChange: true }).reason, 'APPLIED');
    });

    it('holds even for a human, who gains nothing from a no-op write', () => {
        assert.equal(verdict({ current: 'COMPLETED', incoming: 'COMPLETED', actor: 'USER' }).reason, 'NO_CHANGE');
    });
});

describe('row birth', () => {
    it('a row with no stored status is always positionable', () => {
        assert.equal(verdict({ current: null, incoming: 'INPROGRESS', actor: 'PORTAL_SWEEP' }).reason, 'APPLIED');
    });
});

describe('rule 7 - humans and the API are authoritative', () => {
    for (const actor of ['USER', 'API'] as SyncActor[]) {
        it(`${actor} may move a row backwards (a person correcting bad data)`, () => {
            assert.equal(verdict({ current: 'COMPLETED', incoming: 'INPROGRESS', actor }).reason, 'APPLIED');
        });

        it(`${actor} outranks a stale anchor too`, () => {
            assert.equal(verdict({
                current: 'COMPLETED', incoming: 'ASSIGNED', actor,
                incomingAnchor: new Date(T0.getTime() - 24 * HOUR), storedAnchor: T0,
            }).reason, 'APPLIED');
        });
    }
});

describe('rule 3 - TERMINAL_PROTECTED (the O1 oscillation kill switch)', () => {
    it('a live worklist sweep may not reopen a COMPLETED row', () => {
        const d = verdict({ current: 'COMPLETED', incoming: 'INPROGRESS', actor: 'PORTAL_SWEEP' });
        assert.equal(d.allow, false);
        assert.equal(d.reason, 'TERMINAL_PROTECTED');
    });

    it('covers every portal-terminal status, not just COMPLETED', () => {
        for (const current of ['INSTALL_CLOSED', 'PAT_OPMC_PASSED', 'PAT_CORRECTED', 'COMPLETED']) {
            assert.equal(verdict({ current, incoming: 'ASSIGNED', actor: 'PORTAL_SWEEP' }).reason, 'TERMINAL_PROTECTED', current);
        }
    });

    it('is scoped to the open-work feed: the completion feed owns moves inside the terminal band', () => {
        assert.equal(verdict({ current: 'COMPLETED', incoming: 'INSTALL_CLOSED', actor: 'PORTAL_COMPLETED' }).reason, 'APPLIED');
        assert.equal(verdict({ current: 'INSTALL_CLOSED', incoming: 'COMPLETED', actor: 'PORTAL_COMPLETED' }).reason, 'APPLIED');
    });

    it('lets a rank increase through (a closed row cannot be "reopened" by moving forward)', () => {
        assert.equal(verdict({ current: 'COMPLETED', incoming: 'PAT_OPMC_PASSED', actor: 'PORTAL_SWEEP' }).reason, 'APPLIED');
    });
});

describe('rule 4 - RETURN_LOCK', () => {
    it('the open-work feed may not close a returned SOD', () => {
        const d = verdict({ current: 'RETURN', incoming: 'INSTALL_CLOSED', actor: 'PORTAL_SWEEP' });
        assert.equal(d.allow, false);
        assert.equal(d.reason, 'RETURN_LOCK');
    });

    it('completion authority may close it', () => {
        for (const actor of ['PORTAL_COMPLETED', 'AUTO_COMPLETE', 'USER'] as SyncActor[]) {
            assert.equal(verdict({ current: 'RETURN', incoming: 'INSTALL_CLOSED', actor }).reason, 'APPLIED', actor);
        }
    });

    it('reactivation stays allowed - the portal genuinely re-lists returned work', () => {
        assert.equal(verdict({ current: 'RETURN', incoming: 'ASSIGNED', actor: 'PORTAL_SWEEP' }).reason, 'APPLIED');
    });

    it('RETURN itself is storable, so a re-asserted return is NO_CHANGE rather than a lock', () => {
        assert.equal(verdict({ current: 'RETURN', incoming: 'RETURN', actor: 'PORTAL_RETURN' }).reason, 'NO_CHANGE');
    });
});

describe('rule 5 - STALE_ANCHOR (out-of-order feed rows)', () => {
    const older = new Date(T0.getTime() - HOUR);

    it('blocks a downgrade carried by an older CON_STATUS_DATE', () => {
        const d = verdict({
            current: 'COMPLETED', incoming: 'INPROGRESS', actor: 'PORTAL_RETURN',
            incomingAnchor: older, storedAnchor: T0,
        });
        assert.equal(d.allow, false);
        assert.equal(d.reason, 'STALE_ANCHOR');
    });

    it('tolerates the second-granularity rounding of CON_STATUS_DATE', () => {
        // 500ms behind a stored anchor is inside ANCHOR_TOLERANCE_MS, so the feed row is treated as
        // the same instant rather than as history being rewritten.
        assert.equal(verdict({
            current: 'COMPLETED', incoming: 'INPROGRESS', actor: 'PORTAL_RETURN',
            incomingAnchor: new Date(T0.getTime() - 500), storedAnchor: T0,
        }).reason, 'APPLIED');
    });

    it('is skipped when either anchor is missing (the feed did not send CON_STATUS_DATE)', () => {
        assert.equal(verdict({
            current: 'COMPLETED', incoming: 'INPROGRESS', actor: 'PORTAL_RETURN', incomingAnchor: older,
        }).reason, 'APPLIED');
    });

    it('never fires for a rank increase', () => {
        assert.equal(verdict({
            current: 'ASSIGNED', incoming: 'INPROGRESS', actor: 'PORTAL_SWEEP',
            incomingAnchor: new Date(T0.getTime() - 30 * 24 * HOUR), storedAnchor: T0,
        }).reason, 'APPLIED');
    });
});

describe('rule 6 - ILLEGAL_DOWNGRADE for the PAT band', () => {
    it('a PAT feed may not walk a closed row back to COMPLETED', () => {
        const d = verdict({ current: 'INSTALL_CLOSED', incoming: 'COMPLETED', actor: 'PORTAL_PAT' });
        assert.equal(d.allow, false);
        assert.equal(d.reason, 'ILLEGAL_DOWNGRADE');
    });

    it('may record a rejection, which is a rank increase out of COMPLETED', () => {
        assert.equal(verdict({ current: 'COMPLETED', incoming: 'PAT_REJECTED', actor: 'PORTAL_PAT' }).reason, 'APPLIED');
    });

    it('may move laterally inside the same rank (OPMC rejected -> manually corrected)', () => {
        assert.equal(verdict({ current: 'PAT_REJECTED', incoming: 'PAT_OPMC_REJECTED', actor: 'PORTAL_PAT' }).reason, 'APPLIED');
    });

    it('a correction feed outranks a rejection (PAT_REJECTED -> PAT_CORRECTED)', () => {
        assert.equal(verdict({ current: 'PAT_REJECTED', incoming: 'PAT_CORRECTED', actor: 'PORTAL_PAT' }).reason, 'APPLIED');
    });
});

describe('SYNC_STATUS_POLICY rollout switch', () => {
    const saved = process.env.SYNC_STATUS_POLICY;
    after(() => {
        if (saved === undefined) delete process.env.SYNC_STATUS_POLICY;
        else process.env.SYNC_STATUS_POLICY = saved;
    });

    const reopening = input({ current: 'COMPLETED', incoming: 'INPROGRESS', actor: 'PORTAL_SWEEP' });

    it('defaults to logonly when the variable is unset', () => {
        delete process.env.SYNC_STATUS_POLICY;
        assert.equal(syncStatusPolicyMode(), 'logonly');
    });

    it('logonly writes AND reports what would have been blocked', () => {
        process.env.SYNC_STATUS_POLICY = 'logonly';
        const v = evaluateStatusWrite(reopening);
        assert.equal(v.decision.reason, 'TERMINAL_PROTECTED');
        assert.equal(v.proceed, true);
        assert.equal(v.refused, true);
        assert.equal(v.wouldHaveBlocked, true);
    });

    it('enforce refuses it, and the block is no longer hypothetical', () => {
        process.env.SYNC_STATUS_POLICY = 'enforce';
        const v = evaluateStatusWrite(reopening);
        assert.equal(v.proceed, false);
        assert.equal(v.refused, true, 'the census must still count an executed block');
        assert.equal(v.wouldHaveBlocked, false, 'enforce mode did block, it did not "would have" block');
    });

    it('refuses NO_CHANGE and UNKNOWN_STATUS in both modes (they are not authority refusals)', () => {
        for (const mode of ['logonly', 'enforce']) {
            process.env.SYNC_STATUS_POLICY = mode;
            for (const probe of [
                input({ current: 'INPROGRESS', incoming: 'INPROGRESS', actor: 'PORTAL_SWEEP' }),
                input({ current: 'INPROGRESS', incoming: 'RETURNED', actor: 'PORTAL_SWEEP' }),
            ]) {
                const v = evaluateStatusWrite(probe);
                assert.equal(v.proceed, false, `${mode} / ${probe.incoming}`);
                assert.equal(v.refused, false, `${mode} / ${probe.incoming} must not be counted as a policy block`);
                assert.equal(v.wouldHaveBlocked, false);
            }
        }
    });

    it('lets a legitimate write through untouched in enforce mode', () => {
        process.env.SYNC_STATUS_POLICY = 'enforce';
        const v = evaluateStatusWrite(input({ current: 'ASSIGNED', incoming: 'INPROGRESS', actor: 'PORTAL_SWEEP' }));
        assert.equal(v.proceed, true);
        assert.equal(v.refused, false);
        assert.equal(v.wouldHaveBlocked, false);
    });
});
