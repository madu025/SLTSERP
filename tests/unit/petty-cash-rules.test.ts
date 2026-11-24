import { test } from 'node:test';
import assert from 'node:assert/strict';
import { boxSummary, checkDraw, checkOpening, canCancelVoucher, checkRefundIntoBox } from '../../src/lib/petty-cash-rules';

test('the imprest adds up: cash in hand, cash on IOUs and bills waiting make the limit', () => {
    const s = boxSummary({ limit: 100000, balance: 60000, iouOut: 30000, billsWaiting: 10000 });
    assert.equal(s.cashInHand, 60000);
    assert.equal(s.replenishAmount, 10000);
    assert.equal(s.unaccounted, 0);
});
test('an imprest that does not add up shows the gap', () => {
    assert.equal(boxSummary({ limit: 100000, balance: 60000, iouOut: 30000, billsWaiting: 5000 }).unaccounted, 5000);
    assert.equal(boxSummary({ limit: 100000, balance: 60000, iouOut: 45000, billsWaiting: 0 }).unaccounted, -5000);
});
test('cash cannot be drawn that is not in the box', () => {
    assert.equal(checkDraw(6000, 6000).ok, true);
    const r = checkDraw(6000, 6000.01);
    assert.equal(!r.ok && r.reason, 'INSUFFICIENT_PETTY_CASH_BALANCE');
    assert.equal(checkDraw(6000, 0).ok, false);
});
test('a new account starts with what is really in the box', () => {
    assert.equal(checkOpening(100000, 0).ok, true);
    assert.equal(checkOpening(100000, 100000).ok, true);
    assert.equal(checkOpening(100000, 100000.01).ok, false);
    assert.equal(checkOpening(100000, -1).ok, false);
    assert.equal(checkOpening(0, 0).ok, false);
});
test('only a draft bill is cancelled', () => {
    assert.equal(canCancelVoucher('DRAFT'), true);
    for (const s of ['APPROVED', 'REJECTED', 'REIMBURSED', 'CANCELLED']) assert.equal(canCancelVoucher(s), false);
});
test('a refund cannot take the box past its limit', () => {
    assert.equal(checkRefundIntoBox(100000, 98000, 2000).ok, true);
    assert.equal(checkRefundIntoBox(100000, 98000, 2000.01).ok, false);
});

test('a release is approved only by the Area Manager of the site office, never by the person who asked, and never without one', async () => {
    const { checkReleaseApprover } = await import('../../src/lib/petty-cash-rules');
    assert.equal(checkReleaseApprover({ areaManagerId: 'arm', actorId: 'arm', makerId: 'cashier' }).ok, true);
    const none = checkReleaseApprover({ areaManagerId: null, actorId: 'arm' });
    assert.equal(!none.ok && none.reason, 'NO_AREA_MANAGER');
    const other = checkReleaseApprover({ areaManagerId: 'arm', actorId: 'fm', makerId: 'cashier' });
    assert.equal(!other.ok && other.reason, 'NOT_THE_AREA_MANAGER');
    const self = checkReleaseApprover({ areaManagerId: 'arm', actorId: 'arm', makerId: 'arm' });
    assert.equal(!self.ok && self.reason, 'MAKER_CANNOT_APPROVE');
});
