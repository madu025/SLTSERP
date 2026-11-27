import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/**
 * Found 27 Nov 2026 (complaint: the PAT Status Monitor "OPMC PAT REJECT" tab and the dashboard PAT counts were stale):
 * after the 5 Sep 2026 sync rewrite nothing scheduled the OPMC-level PAT sync (syncPatResults per RTOM, feed PAT),
 * so SLTPATStatus rows from the OPMC feeds stopped on 11 Sep while the HO feeds kept running.
 */
const read = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');

test('the OPMC PAT sync is a 30-minute bucket job of the tick, worker only', () => {
    const svc = read('src/services/service-order/sod.sync.service.ts');
    assert.match(svc, /\{ name: 'periodic-opmc-pat-sync', type: 'PERIODIC_OPMC_PAT_SYNC', everyMs: 30 \* 60 \* 1000, inlineCostMs: 0 \}/);
    assert.match(svc, /if \(type === 'PERIODIC_OPMC_PAT_SYNC'\) \{/);
    assert.ok(svc.includes("{ feed: 'PAT', opmcId: opmc.id, rtom: opmc.rtom, window }"), 'one census row per RTOM, feed PAT');
    assert.ok(svc.includes('() => this.syncPatResults(opmc.id as UUID, opmc.rtom)'));
});

test('the worker handles the new job type and the type list carries it', () => {
    assert.match(read('src/workers/sod-sync.worker.ts'), /async PERIODIC_OPMC_PAT_SYNC\(\) \{[\s\S]{0,200}runPeriodicTask\('PERIODIC_OPMC_PAT_SYNC'\)/);
    assert.match(read('src/services/service-order/sync/types.ts'), /\| 'PERIODIC_OPMC_PAT_SYNC';/);
    assert.match(read('src/services/service-order/index.ts'), /'PERIODIC_OPMC_PAT_SYNC'/);
});
