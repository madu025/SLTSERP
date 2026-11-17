import { test } from 'node:test';
import assert from 'node:assert/strict';
import { swrMemo } from '../../src/lib/swr-memo';

test('swrMemo serves fresh values without recomputing and shares in-flight work', async () => {
    let calls = 0;
    const fn = async () => { calls++; await new Promise((r) => setTimeout(r, 5)); return 1; };
    const [a, b] = await Promise.all([swrMemo('k1', 1000, 5000, fn), swrMemo('k1', 1000, 5000, fn)]);
    assert.deepEqual([a, b], [1, 1]);
    await swrMemo('k1', 1000, 5000, fn);
    assert.equal(calls, 1);
});

test('swrMemo returns the stale value at once and refreshes in the background', async () => {
    let n = 0;
    const fn = async () => ++n;
    assert.equal(await swrMemo('k2', 0, 60_000, fn), 1);
    assert.equal(await swrMemo('k2', 0, 60_000, fn), 1);
    await new Promise((r) => setTimeout(r, 20));
    assert.equal(await swrMemo('k2', 0, 60_000, fn), 2);
});

test('swrMemo keys never mix', async () => {
    assert.equal(await swrMemo('ka', 1000, 5000, async () => 'a'), 'a');
    assert.equal(await swrMemo('kb', 1000, 5000, async () => 'b'), 'b');
});
