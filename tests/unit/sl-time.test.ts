import { test } from 'node:test';
import assert from 'node:assert/strict';
import { slInstant, slDayKey, slStartOfDayKey, slDaysInMonth } from '../../src/lib/sl-time';
import { monthBounds, lastMonths } from '../../src/services/core/company-health.service';
import { resolvePeriod } from '../../src/services/ai/executive-metrics.service';

test('a Colombo day starts at 18:30 UTC the evening before', () => {
    assert.equal(slInstant(2026, 10, 1).toISOString(), '2026-10-31T18:30:00.000Z');
    assert.equal(slDayKey(new Date('2026-10-31T18:30:00Z')), '2026-11-01');
    assert.equal(slDayKey(new Date('2026-10-31T18:29:59Z')), '2026-10-31');
    assert.equal(slStartOfDayKey('2026-11-01').toISOString(), '2026-10-31T18:30:00.000Z');
    assert.equal(slDaysInMonth(2026, 1), 28);
});

test('an order completed at 01:00 Colombo on the 1st belongs to the new month', () => {
    const completed = new Date('2026-10-31T19:30:00Z'); // 01:00 on 1 Nov in Colombo
    const b = monthBounds(new Date('2026-11-15T06:00:00Z'));
    assert.ok(completed >= b.currentStart && completed < new Date('2026-12-01T00:00:00Z'));
    assert.equal(b.currentStart.toISOString(), '2026-10-31T18:30:00.000Z');
    assert.equal(b.previousEnd.toISOString(), '2026-10-31T18:29:59.999Z');
});

test('just after Colombo midnight at month start the new month is already current', () => {
    const now = new Date('2026-10-31T19:00:00Z'); // 00:30 on 1 Nov in Colombo, still 31 Oct in UTC
    assert.equal(resolvePeriod('this_month', now).label, 'Nov 2026');
    assert.equal(resolvePeriod('last_month', now).label, 'Oct 2026');
    assert.equal(lastMonths(now, 2).map((m) => m.label).join(','), 'Oct,Nov');
});

test('weeks start on Monday in Colombo time', () => {
    const sundayNightUtc = new Date('2026-11-15T19:00:00Z'); // 00:30 Monday 16 Nov in Colombo
    assert.equal(resolvePeriod('this_week', sundayNightUtc).from.toISOString(), '2026-11-15T18:30:00.000Z');
});
