import { test } from 'node:test';
import assert from 'node:assert/strict';
import { iouOutstanding, settlementStatus, daysOutstanding, floatAvailable, checkIssue, checkSettlement, settlementPosting } from '../../src/lib/osp-float-rules';

test('outstanding is the issued amount less bills and refunds; reminders carry no money', () => {
    assert.equal(iouOutstanding(10000, []), 10000);
    assert.equal(iouOutstanding(10000, [{ kind: 'BILLS', amount: 6500 }, { kind: 'REFUND', amount: 1500 }, { kind: 'REMINDER', amount: 0 }]), 2000);
    assert.equal(iouOutstanding(10000, [{ kind: 'BILLS', amount: 10000 }]), 0);
});

test('settlement status follows the outstanding amount', () => {
    assert.equal(settlementStatus(10000, 10000), 'OPEN');
    assert.equal(settlementStatus(10000, 4000), 'PARTIALLY_SETTLED');
    assert.equal(settlementStatus(10000, 0), 'SETTLED');
});

test('days outstanding counts whole days and is never negative', () => {
    const now = new Date('2026-11-24T10:00:00Z');
    assert.equal(daysOutstanding(new Date('2026-11-14T10:00:00Z'), now), 10);
    assert.equal(daysOutstanding(new Date('2026-12-01T10:00:00Z'), now), 0);
    assert.equal(daysOutstanding(null, now), 0);
});

test('float available is the limit less the outstanding on approved IOUs', () => {
    assert.equal(floatAvailable(100000, 46115.5), 53884.5);
    assert.equal(floatAvailable(100000, 103347.67), -3347.67);
});

test('an IOU beyond the float is refused (the paper register let the balance go negative)', () => {
    const base = { floatLimit: 100000, outstandingOthers: 95000, staffOpenIous: [], maxDaysOutstanding: 30 };
    assert.equal(checkIssue({ ...base, amount: 5000 }).ok, true);
    const over = checkIssue({ ...base, amount: 5000.01 });
    assert.equal(over.ok, false);
    assert.equal(!over.ok && over.reason, 'FLOAT_EXCEEDED');
    assert.equal(checkIssue({ ...base, amount: 0 }).ok, false);
});

test('a person with an overdue unsettled IOU gets no new one; the days limit is the float\'s own, 0 means none', () => {
    const base = { floatLimit: 100000, outstandingOthers: 0, amount: 1000 };
    const overdue = [{ outstanding: 500, days: 45 }];
    const r = checkIssue({ ...base, staffOpenIous: overdue, maxDaysOutstanding: 30 });
    assert.equal(!r.ok && r.reason, 'STAFF_HAS_OVERDUE_IOU');
    assert.equal(checkIssue({ ...base, staffOpenIous: overdue, maxDaysOutstanding: 0 }).ok, true);
    assert.equal(checkIssue({ ...base, staffOpenIous: [{ outstanding: 0, days: 90 }], maxDaysOutstanding: 30 }).ok, true);
    assert.equal(checkIssue({ ...base, staffOpenIous: [{ outstanding: 500, days: 10 }], maxDaysOutstanding: 30 }).ok, true);
});

test('settlement rules: only an issued IOU, never more than outstanding, reminders have no money', () => {
    const ok = { kind: 'BILLS', amount: 4000, outstanding: 5000, iouStatus: 'APPROVED' };
    assert.equal(checkSettlement(ok).ok, true);
    assert.equal(checkSettlement({ ...ok, iouStatus: 'PENDING' }).ok, false);
    assert.equal(checkSettlement({ ...ok, amount: 5000.01 }).ok, false);
    assert.equal(checkSettlement({ ...ok, amount: 0 }).ok, false);
    assert.equal(checkSettlement({ ...ok, outstanding: 0 }).ok, false);
    assert.equal(checkSettlement({ ...ok, kind: 'SALARY' }).ok, false);
    assert.equal(checkSettlement({ kind: 'REMINDER', amount: 0, outstanding: 5000, iouStatus: 'APPROVED' }).ok, true);
    assert.equal(checkSettlement({ kind: 'REMINDER', amount: 10, outstanding: 5000, iouStatus: 'APPROVED' }).ok, false);
    assert.equal(checkSettlement({ kind: 'REMINDER', amount: 0, outstanding: 0, iouStatus: 'APPROVED' }).ok, true);
});

test('bills are an expense by float type, a refund returns the cash', () => {
    assert.deepEqual(settlementPosting('BILLS', 'PETTY_CASH'), { debit: 'EXPENSE_PETTY', credit: 'ADVANCES' });
    assert.deepEqual(settlementPosting('BILLS', 'PROJECT_ADVANCE'), { debit: 'EXPENSE_OSP', credit: 'ADVANCES' });
    assert.deepEqual(settlementPosting('REFUND', 'PETTY_CASH'), { debit: 'BANK', credit: 'ADVANCES' });
    assert.deepEqual(settlementPosting('REFUND', 'PETTY_CASH', true), { debit: 'PETTY_CASH', credit: 'ADVANCES' });
});
