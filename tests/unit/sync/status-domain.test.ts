/**
 * Domain invariants behind the policy (plan Section 8, normalizer bullet).
 *
 * These are the tables the sync rewrite reads instead of hard-coding strings, so the failure mode
 * being defended against is a table that quietly stops covering the enum: a status with no rank
 * makes `rankOf` return null, which disables every downgrade rule without any error anywhere.
 *
 * Run: npm run test:unit
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
    SodStatus,
    SOD_EXCLUDED_FROM_PENDING,
    SOD_EXTERNAL_COMPLETION_STATUSES,
    SOD_PENDING_DEFAULT_STATUSES,
    SOD_QUERY_COMPLETION_STATUSES,
    SOD_RETURN_STATUSES,
    SOD_SLTS_STATUS_VALUES,
    SOD_SLTS_TERMINAL_STATUSES,
    SOD_STALE_ACTIVE_STATUSES,
    SOD_SYNC_COMPLETION_STATUSES,
    SOD_WORKFLOW_STATUS_VALUES,
} from '../../../src/lib/constants/sod-constants';
import {
    SOD_STATUS_RANK,
    authorityActorFor,
    isReturnLikeSltsStatus,
    isStorableSltsStatus,
    isTerminalSltsStatus,
} from '../../../src/lib/constants/sod-status-policy';

const ALL_STATUSES = Object.values(SodStatus);
const SLTS_DOMAIN: readonly string[] = SOD_SLTS_STATUS_VALUES;
const TERMINAL: readonly string[] = SOD_SLTS_TERMINAL_STATUSES;

describe('rank table coverage', () => {
    it('gives every status in the enum a rank', () => {
        const missing = ALL_STATUSES.filter(s => typeof (SOD_STATUS_RANK as Record<string, number>)[s] !== 'number');
        assert.deepEqual(missing, [], 'a status without a rank disables the downgrade rules silently');
    });

    it('declares no rank for a status that does not exist', () => {
        const extra = Object.keys(SOD_STATUS_RANK).filter(k => !ALL_STATUSES.includes(k as SodStatus));
        assert.deepEqual(extra, []);
    });

    it('is monotone along the path a real SOD walks', () => {
        const path: string[] = [SodStatus.PENDING, SodStatus.ASSIGNED, SodStatus.INPROGRESS,
            SodStatus.PROV_CLOSED, SodStatus.COMPLETED, SodStatus.INSTALL_CLOSED, SodStatus.PAT_OPMC_PASSED];
        const ranks = path.map(s => (SOD_STATUS_RANK as Record<string, number>)[s]);
        for (let i = 1; i < ranks.length; i++) {
            assert.ok(ranks[i] > ranks[i - 1], `${path[i]} must rank above ${path[i - 1]}`);
        }
    });
});

describe('storage domains', () => {
    it('terminal statuses are all storable in sltsStatus', () => {
        for (const s of TERMINAL) assert.ok(SLTS_DOMAIN.includes(s), `${s} is terminal but not storable`);
    });

    it('a workflow status that is stale-active can never be terminal', () => {
        for (const s of SOD_STALE_ACTIVE_STATUSES as readonly string[]) {
            assert.ok(!TERMINAL.includes(s), `${s} is both stale-active and terminal`);
        }
    });

    it('RETURN lives in the portal-mirror domain only (it is never an ERP workflow state)', () => {
        assert.ok(SLTS_DOMAIN.includes(SodStatus.RETURN));
        assert.ok(!(SOD_WORKFLOW_STATUS_VALUES as readonly string[]).includes(SodStatus.RETURN));
    });

    it('PENDING lives in the workflow domain only', () => {
        assert.ok((SOD_WORKFLOW_STATUS_VALUES as readonly string[]).includes(SodStatus.PENDING));
        assert.ok(!SLTS_DOMAIN.includes(SodStatus.PENDING));
    });

    it('every workflow value except PENDING is also a legal sltsStatus', () => {
        const orphans = (SOD_WORKFLOW_STATUS_VALUES as readonly string[]).filter(s => s !== SodStatus.PENDING && !SLTS_DOMAIN.includes(s));
        assert.deepEqual(orphans, []);
    });
});

describe('external portal strings are never stored', () => {
    // The portal speaks RETURNED / CANCELLED / RETURN_PENDING / FINISHED; the ERP stores the mapped
    // value. Anything that fails to map must be dropped by the writer, not written raw.
    for (const raw of ['RETURNED', 'CANCELLED', 'RETURN_PENDING', 'FINISHED', 'PAT_PASSED', 'NEW', 'CLOSED']) {
        it(`"${raw}" is not a storable sltsStatus`, () => {
            assert.equal(isStorableSltsStatus(raw), false);
        });
    }

    it('the external completion vocabulary covers every status the queries treat as complete', () => {
        // SOD_QUERY_COMPLETION_STATUSES is matched against the stored column, SOD_EXTERNAL_COMPLETION_STATUSES
        // against raw portal rows: a completion the query layer counts must be recognisable upstream.
        const outside = (SOD_QUERY_COMPLETION_STATUSES as readonly string[])
            .filter(s => !(SOD_EXTERNAL_COMPLETION_STATUSES as readonly string[]).includes(s));
        assert.deepEqual(outside, []);
    });

    it('the sync-side completion matcher covers the stored ones too', () => {
        const outside = [SodStatus.COMPLETED, SodStatus.INSTALL_CLOSED]
            .filter(s => !(SOD_SYNC_COMPLETION_STATUSES as readonly string[]).includes(s));
        assert.deepEqual(outside, []);
    });

    it('lists matched against stored columns hold only values their own column can hold', () => {
        // SOD_PENDING_DEFAULT_STATUSES filters the workflow `status` column, where PENDING is legal.
        const workflowDomain: readonly string[] = SOD_WORKFLOW_STATUS_VALUES;
        for (const [name, list] of Object.entries({
            SOD_QUERY_COMPLETION_STATUSES,
            SOD_EXCLUDED_FROM_PENDING,
            SOD_PENDING_DEFAULT_STATUSES,
        })) {
            const bad = (list as readonly string[]).filter(s => !isStorableSltsStatus(s) && !(workflowDomain as readonly string[]).includes(s));
            assert.deepEqual(bad, [], `${name} is matched against a stored column`);
        }
    });

    it('RETURN is the only storable member of the return matcher (the rest are portal strings)', () => {
        const storable = (SOD_RETURN_STATUSES as readonly string[]).filter(isStorableSltsStatus);
        assert.deepEqual(storable, [SodStatus.RETURN]);
    });

    it('empty and null are not storable', () => {
        assert.equal(isStorableSltsStatus(''), false);
        assert.equal(isStorableSltsStatus(null), false);
        assert.equal(isStorableSltsStatus(undefined), false);
    });
});

describe('authorityActorFor (a recovery pass cannot claim one actor for every row)', () => {
    it('routes a return to the return feed', () => {
        assert.equal(authorityActorFor(SodStatus.RETURN), 'PORTAL_RETURN');
    });

    it('routes every portal-terminal status to the completion feed', () => {
        for (const s of TERMINAL) assert.equal(authorityActorFor(s), 'PORTAL_COMPLETED', s);
    });

    it('leaves open-work observations with the sweep', () => {
        for (const s of [SodStatus.ASSIGNED, SodStatus.INPROGRESS, SodStatus.PROV_CLOSED, SodStatus.DISAPPEARED]) {
            assert.equal(authorityActorFor(s), 'PORTAL_SWEEP', s);
        }
    });

    it('treats an unrecognised portal string as an open-work observation, never as completion', () => {
        assert.equal(authorityActorFor('RETURN_PENDING'), 'PORTAL_SWEEP');
        assert.equal(authorityActorFor(null), 'PORTAL_SWEEP');
    });
});

describe('predicate helpers agree with the tables they read', () => {
    it('isTerminalSltsStatus is exactly the terminal list', () => {
        for (const s of ALL_STATUSES) {
            assert.equal(isTerminalSltsStatus(s), TERMINAL.includes(s), s);
        }
    });

    it('DISAPPEARED is return-like (parked), RETURN is return-like, nothing else is', () => {
        assert.equal(isReturnLikeSltsStatus(SodStatus.RETURN), true);
        assert.equal(isReturnLikeSltsStatus(SodStatus.DISAPPEARED), true);
        assert.equal(isReturnLikeSltsStatus(SodStatus.PAT_REJECTED), false);
        assert.equal(isReturnLikeSltsStatus(null), false);
    });

    it('a null or empty status is never terminal', () => {
        assert.equal(isTerminalSltsStatus(null), false);
        assert.equal(isTerminalSltsStatus(''), false);
    });
});
