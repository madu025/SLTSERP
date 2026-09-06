/**
 * Daily Operational Report - born-terminal closure invariant (D-C2).
 *
 * `classifySodDayActivity` is a pure function, so the invariant is assertable without a database.
 *
 * The sync birth-history seed (SODLifecycleService.seedBirthHistoryBatch) dates a newly created
 * SOD's first status-history event at the row's own ERP `createdAt` - NOT the portal
 * CON_STATUS_DATE. The classifier recognises that instant and drops the birth event from the
 * closure-evidence channel, so a SOD the ERP merely DISCOVERED already-closed today cannot be
 * counted as a closure the ERP OBSERVED today. Without this the report inflates by ~255/day
 * (~2,036 SODs carry a portal statusDate on the same SLT day as their ERP createdAt) - the exact
 * failure the R-MD "36 completions where iShamp listed 5" discipline exists to prevent.
 *
 * Run: npm run test:unit
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { classifySodDayActivity } from '../../../src/services/core/daily-report-activity';
import type { SodDayActivitySource, SodDayWindow } from '../../../src/services/core/daily-report-activity';

/** One report day. The classifier only compares instants against the window, so UTC is fine. */
const WINDOW: SodDayWindow = {
    start: new Date('2026-09-06T00:00:00.000Z'),
    end: new Date('2026-09-06T23:59:59.999Z'),
};

/** A moment inside the report day (an SOD discovered/created today). */
const TODAY = new Date('2026-09-06T08:30:00.000Z');
/** A moment before the report day opened (an SOD the ERP already held). */
const EARLIER = new Date('2026-08-27T08:30:00.000Z');

function source(over: Partial<SodDayActivitySource> & Pick<SodDayActivitySource, 'createdAt'>): SodDayActivitySource {
    return {
        status: null,
        sltsStatus: null,
        receivedDate: null,
        statusDate: null,
        completedDate: null,
        wiredOnly: false,
        statusHistory: [],
        materialUsage: [],
        teamId: null,
        ...over,
    };
}

describe('D-C2 - a born-terminal SOD discovered today is NOT an ERP-observed closure', () => {
    it('born COMPLETED today: the birth event (statusDate === createdAt) does not flip completedToday', () => {
        const order = source({
            createdAt: TODAY,
            status: 'COMPLETED',
            sltsStatus: 'COMPLETED',
            // The seed dates the birth at createdAt, so it is recognised as a birth and excluded.
            statusHistory: [{ status: 'COMPLETED', statusDate: TODAY }],
            // Even with the portal completion instant landing in-window today, the counters stay
            // closed: the row was not held before the day opened and the ERP observed no transition.
            completedDate: new Date('2026-09-06T09:00:00.000Z'),
            statusDate: new Date('2026-09-06T09:00:00.000Z'),
        });
        const activity = classifySodDayActivity(order, WINDOW);
        assert.equal(activity.completedToday, false);
        assert.equal(activity.installClosedToday, false);
    });

    it('born INSTALL_CLOSED today: the birth event does not flip installClosedToday', () => {
        const order = source({
            createdAt: TODAY,
            status: 'INSTALL_CLOSED',
            sltsStatus: 'INSTALL_CLOSED',
            statusHistory: [{ status: 'INSTALL_CLOSED', statusDate: TODAY }],
            completedDate: new Date('2026-09-06T09:00:00.000Z'),
            statusDate: new Date('2026-09-06T09:00:00.000Z'),
        });
        const activity = classifySodDayActivity(order, WINDOW);
        assert.equal(activity.installClosedToday, false);
        assert.equal(activity.completedToday, false);
    });

    it('a non-terminal birth today is open-work attribution, never a closure', () => {
        for (const status of ['PENDING', 'INPROGRESS', 'ASSIGNED']) {
            const order = source({
                createdAt: TODAY,
                status,
                sltsStatus: status,
                statusHistory: [{ status, statusDate: TODAY }],
            });
            const activity = classifySodDayActivity(order, WINDOW);
            assert.equal(activity.completedToday, false, status);
            assert.equal(activity.installClosedToday, false, status);
        }
    });
});

describe('D-C2 - the exclusion is precise, so genuine closures still count', () => {
    it('a COMPLETED event dated away from createdAt IS closure evidence (why the seed dates births at createdAt)', () => {
        const order = source({
            createdAt: TODAY,
            status: 'COMPLETED',
            sltsStatus: 'COMPLETED',
            // Counterfactual: had the seed used the portal stamp (in-window, hours off createdAt) the
            // event would NOT be a birth and WOULD count - the ~255/day inflation D-C2 removes.
            statusHistory: [{ status: 'COMPLETED', statusDate: new Date('2026-09-06T14:00:00.000Z') }],
        });
        assert.equal(classifySodDayActivity(order, WINDOW).completedToday, true);
    });

    it('a non-terminal birth today plus a genuine same-day COMPLETED transition still counts', () => {
        const completedAt = new Date('2026-09-06T15:00:00.000Z');
        const order = source({
            createdAt: TODAY,
            status: 'COMPLETED',
            sltsStatus: 'COMPLETED',
            statusHistory: [
                { status: 'INPROGRESS', statusDate: TODAY },        // birth event - excluded
                { status: 'COMPLETED', statusDate: completedAt },   // real transition - kept
            ],
            completedDate: completedAt,
        });
        assert.equal(classifySodDayActivity(order, WINDOW).completedToday, true);
    });

    it('a SOD held before today that the ERP completes in-window counts as completedToday', () => {
        const completedAt = new Date('2026-09-06T11:00:00.000Z');
        const order = source({
            createdAt: EARLIER,
            status: 'COMPLETED',
            sltsStatus: 'COMPLETED',
            statusHistory: [
                { status: 'INPROGRESS', statusDate: EARLIER },      // birth event - excluded
                { status: 'COMPLETED', statusDate: completedAt },   // real transition - kept
            ],
            completedDate: completedAt,
        });
        assert.equal(classifySodDayActivity(order, WINDOW).completedToday, true);
    });

    it('honours the 2s birth tolerance: within it a COMPLETED event is the birth, beyond it a transition', () => {
        const withinTolerance = source({
            createdAt: TODAY,
            status: 'COMPLETED',
            sltsStatus: 'COMPLETED',
            statusHistory: [{ status: 'COMPLETED', statusDate: new Date(TODAY.getTime() + 1500) }],
        });
        assert.equal(classifySodDayActivity(withinTolerance, WINDOW).completedToday, false);

        const beyondTolerance = source({
            createdAt: TODAY,
            status: 'COMPLETED',
            sltsStatus: 'COMPLETED',
            statusHistory: [{ status: 'COMPLETED', statusDate: new Date(TODAY.getTime() + 5000) }],
        });
        assert.equal(classifySodDayActivity(beyondTolerance, WINDOW).completedToday, true);
    });
});

describe('D-C2 - the RETURN precedent and non-closure channels are untouched', () => {
    it('a SOD born RETURN today still counts as returnedToday (RETURN reads the full history)', () => {
        const order = source({
            createdAt: TODAY,
            status: 'RETURN',
            sltsStatus: 'RETURN',
            // RETURN birth is dated at the ERP capture instant (createdAt) per the seed's precedent.
            statusHistory: [{ status: 'RETURN', statusDate: TODAY }],
            statusDate: TODAY,
        });
        assert.equal(classifySodDayActivity(order, WINDOW).returnedToday, true);
    });

    it('the birth exclusion is scoped to the closure channel only (PROV_CLOSED event attribution survives)', () => {
        const order = source({
            createdAt: TODAY,
            status: 'PROV_CLOSED',
            sltsStatus: 'PROV_CLOSED',
            statusHistory: [{ status: 'PROV_CLOSED', statusDate: TODAY }],
            statusDate: TODAY,
        });
        const activity = classifySodDayActivity(order, WINDOW);
        // provClosedEventToday reads the FULL history, so the birth event still attributes the day.
        assert.equal(activity.provClosedEventToday, true);
        // It is not a COMPLETED/INSTALL_CLOSED closure, so the closure counters stay closed.
        assert.equal(activity.completedToday, false);
        assert.equal(activity.installClosedToday, false);
    });
});
