/**
 * Writer integration test (plan Section 8, second bullet), deliberately write-free.
 *
 * The portal feeds cannot be replayed in a test, but the load-bearing property is what the single
 * door does with an unchanged or a refused instruction: it must touch nothing. So this walks
 * `applySodStatus` against real stored rows and asserts the absence of side effects - no row write,
 * no `updatedAt` bump (defect O8), no status-history row (O3), no notification (O2).
 *
 * Neither case writes, so the test is safe against any database and needs no seed. It is still
 * opt-in, so `npm run test:unit` on a laptop without a reachable database stays green:
 *
 *   $env:SYNC_INTEGRATION_DB='1'; npm run test:integration
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { primaryClient } from '../../src/lib/prisma';
import { applySodStatus } from '../../src/services/service-order/sync/sod-status.writer';
import { SodStatus, SOD_SLTS_STATUS_VALUES, SOD_SLTS_TERMINAL_STATUSES } from '../../src/lib/constants/sod-constants';
import type { UUID } from '../../src/types/common';

const enabled = process.env.SYNC_INTEGRATION_DB === '1';
const savedPolicy = process.env.SYNC_STATUS_POLICY;

const SELECT = {
    id: true, soNum: true, opmcId: true, status: true, sltsStatus: true,
    statusDate: true, completedDate: true, returnReason: true, updatedAt: true,
} as const;

type Row = {
    id: string; soNum: string; opmcId: string; status: string | null; sltsStatus: string | null;
    statusDate: Date | null; completedDate: Date | null; returnReason: string | null; updatedAt: Date;
};

const TERMINAL = [...SOD_SLTS_TERMINAL_STATUSES];
// Prisma refuses `null` for a nullable enum filter (even under NOT), so "has a stored status" is
// expressed as the positive domain instead - which is also the stricter question.
const ANY_STORED = [...SOD_SLTS_STATUS_VALUES];

async function historyCount(sodId: string): Promise<number> {
    return primaryClient.serviceOrderStatusHistory.count({ where: { serviceOrderId: sodId } });
}

async function notificationCount(sodId: string): Promise<number> {
    // The sync feeds address a SOD through `link`, which is their only stable reference;
    // metadata is written inconsistently across producers.
    return primaryClient.notification.count({ where: { link: { contains: sodId } } });
}

async function loadRow(where: object): Promise<Row | null> {
    return primaryClient.serviceOrder.findFirst({ where, select: SELECT, orderBy: { updatedAt: 'desc' } });
}

/** Run one instruction, then prove the whole SOD view is exactly as it was; hands back its verdict. */
async function expectInert<T>(sod: Row, run: () => Promise<T>): Promise<T> {
    const historyBefore = await historyCount(sod.id);
    const notificationsBefore = await notificationCount(sod.id);

    const result = await run();

    const after = await primaryClient.serviceOrder.findUniqueOrThrow({ where: { id: sod.id }, select: SELECT });
    assert.equal(after.updatedAt.getTime(), sod.updatedAt.getTime(), 'a write-free verdict must not bump updatedAt');
    assert.equal(after.sltsStatus, sod.sltsStatus);
    assert.equal(after.status, sod.status);
    assert.equal(after.completedDate?.getTime() ?? null, sod.completedDate?.getTime() ?? null);
    assert.equal(await historyCount(sod.id), historyBefore, 'status history must not gain a row');
    assert.equal(await notificationCount(sod.id), notificationsBefore, 'the outbox must not gain a row');
    return result;
}

describe('applySodStatus against stored rows', { skip: enabled ? false : 'set SYNC_INTEGRATION_DB=1' }, () => {
    it('re-asserting a stored status is inert (the O8 no-op write)', async () => {
        const sod = await loadRow({ sltsStatus: { in: ANY_STORED } });
        assert.ok(sod, 'no SOD with a stored sltsStatus to reason about');

        const result = await expectInert(sod, () => applySodStatus({
            sodId: sod.id as UUID,
            soNum: sod.soNum,
            opmcId: sod.opmcId as UUID,
            // Exactly what is already stored, with no field forcing the change.
            next: { sltsStatus: sod.sltsStatus, status: sod.status, completedDate: sod.completedDate, returnReason: sod.returnReason },
            anchor: sod.statusDate,
            actor: 'PORTAL_SWEEP',
            reason: 'integration: unchanged feed row',
        }));

        assert.equal(result.changed, false);
        assert.equal(result.decision.reason, 'NO_CHANGE');
    });

    it('a sweep cannot reopen a closed SOD, and the refusal writes nothing (the O1 oscillation)', async () => {
        process.env.SYNC_STATUS_POLICY = 'enforce';
        try {
            const sod = await loadRow({ sltsStatus: { in: TERMINAL } });
            assert.ok(sod, 'no SOD carries a terminal sltsStatus');

            const result = await expectInert(sod, () => applySodStatus({
                sodId: sod.id as UUID,
                soNum: sod.soNum,
                opmcId: sod.opmcId as UUID,
                next: { sltsStatus: SodStatus.INPROGRESS },
                anchor: new Date(),
                actor: 'PORTAL_SWEEP',
                reason: 'integration: live worklist still lists a closed SOD',
            }));

            assert.equal(result.changed, false);
            assert.equal(result.decision.reason, 'TERMINAL_PROTECTED');
            assert.equal(result.refusedByPolicy, true, 'the census must count an executed block');
            assert.equal(result.wouldHaveBlocked, false, 'enforce mode did block, it did not "would have" block');
        } finally {
            if (savedPolicy === undefined) delete process.env.SYNC_STATUS_POLICY;
            else process.env.SYNC_STATUS_POLICY = savedPolicy;
        }
    });

    it('a field-only intent on a closed row keeps the status columns alone', async () => {
        const sod = await loadRow({ sltsStatus: { in: TERMINAL } });
        assert.ok(sod, 'no SOD carries a terminal sltsStatus');

        const result = await expectInert(sod, () => applySodStatus({
            sodId: sod.id as UUID,
            soNum: sod.soNum,
            opmcId: sod.opmcId as UUID,
            // No status in the intent at all: rules 1-6 cannot fire, so the writer must be a no-op
            // rather than inventing a transition (this is how a return-reason enrichment arrives).
            next: { returnReason: sod.returnReason },
            anchor: null,
            actor: 'PORTAL_RETURN',
            reason: 'integration: return reason refresh',
        }));

        assert.equal(result.decision.reason, 'NO_CHANGE');
        assert.equal(result.changed, false);
    });
});
