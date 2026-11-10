import assert from 'node:assert/strict';
import { test } from 'node:test';
import { retentionCutoff, retentionMonths, toJsonLines } from '../../src/services/audit/audit-retention.service';

test('retention window defaults to 24 months and never drops below 12', () => {
  assert.equal(retentionMonths(undefined), 24);
  assert.equal(retentionMonths('36'), 36);
  assert.equal(retentionMonths('3'), 24);
  assert.equal(retentionMonths('abc'), 24);
});

test('cutoff is the given number of months back', () => {
  assert.equal(retentionCutoff(new Date('2026-11-10T00:00:00Z'), 24).toISOString(), '2024-11-10T00:00:00.000Z');
});

test('archive lines are one JSON object per row', () => {
  const out = toJsonLines([{ id: '1' }, { id: '2' }]);
  assert.deepEqual(out.trim().split('\n').map((l) => JSON.parse(l)), [{ id: '1' }, { id: '2' }]);
});
