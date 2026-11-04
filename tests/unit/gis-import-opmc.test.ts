import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolveImportOpmc, type OpmcCandidate } from '../../src/lib/gis/import-opmc';

// REGION 03 holds many OPMCs, which is what made "region contains text" pick the wrong one.
const OPMCS: OpmcCandidate[] = [
  { id: 'a', name: 'OPMC R-AD', rtom: 'R-AD', region: 'REGION 03' },
  { id: 'b', name: 'OPMC R-AP', rtom: 'R-AP', region: 'REGION 03' },
  { id: 'c', name: 'OPMC K-GL', rtom: 'K-GL', region: 'REGION 01' },
];

test('explicit opmcId wins over district and region text', () => {
  assert.deepEqual(resolveImportOpmc(OPMCS, { opmcId: 'a', district: 'OPMC R-AP', region: 'REGION 03' }), { id: 'a', by: 'id' });
});

test('an unknown opmcId is reported instead of silently falling back', () => {
  assert.deepEqual(resolveImportOpmc(OPMCS, { opmcId: 'zzz', region: 'REGION 03' }), { id: null, by: 'unknown-id' });
});

test('the upload page sends the OPMC name as district: exact match, not first-in-region', () => {
  assert.deepEqual(resolveImportOpmc(OPMCS, { district: 'OPMC R-AD', region: 'REGION 03' }), { id: 'a', by: 'name' });
  assert.deepEqual(resolveImportOpmc(OPMCS, { district: 'r-ap' }), { id: 'b', by: 'name' });
});

test('a region shared by several OPMCs is ambiguous and is never guessed', () => {
  assert.deepEqual(resolveImportOpmc(OPMCS, { region: 'REGION 03' }), { id: null, by: 'ambiguous-region', candidates: 2 });
});

test('a region with exactly one OPMC resolves, and no hint resolves to nothing', () => {
  assert.deepEqual(resolveImportOpmc(OPMCS, { region: 'region 01' }), { id: 'c', by: 'region' });
  assert.deepEqual(resolveImportOpmc(OPMCS, {}), { id: null, by: 'none' });
});
