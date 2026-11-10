import assert from 'node:assert/strict';
import { test } from 'node:test';
import { optionalUuid, parsePaging, requireAmount, requireDate, requireSafeUrl, requireText, requireUuid } from '../../src/lib/input-guards';
import { amountInput, validDateInput } from '../../src/lib/validations/project-inputs';

const UUID = '01a1c441-0ec9-9252-e270-75d611417759';

test('requireText trims, strips bidi/control characters and enforces type and length', () => {
  assert.equal(requireText('  Project A  ', 'name', 10), 'Project A');
  assert.equal(requireText('ab\u202Ecd', 'name', 10), 'abcd');
  for (const bad of [12345, ['x'], null, undefined, '   ', 'x'.repeat(11)]) {
    assert.throws(() => requireText(bad, 'name', 10), `rejects ${String(bad)}`);
  }
});

test('uuid helpers reject malformed ids and tolerate empty optionals', () => {
  assert.equal(requireUuid(UUID, 'id'), UUID);
  assert.throws(() => requireUuid('not-a-uuid', 'id'));
  assert.throws(() => requireUuid(12345, 'id'));
  assert.equal(optionalUuid(undefined, 'id'), undefined);
  assert.equal(optionalUuid('', 'id'), undefined);
  assert.throws(() => optionalUuid('zzz', 'id'));
});

test('parsePaging never yields NaN, zero, negative or unbounded values', () => {
  assert.deepEqual(parsePaging('-1', 'abc'), { page: 1, limit: 50 });
  assert.deepEqual(parsePaging('0', '0'), { page: 1, limit: 50 });
  assert.deepEqual(parsePaging('3', '1000000'), { page: 3, limit: 200 });
  assert.deepEqual(parsePaging(null, null), { page: 1, limit: 50 });
});

test('amounts must be finite, in range and are rounded', () => {
  assert.equal(requireAmount('12.345', 'amount'), 12.35);
  assert.equal(requireAmount(0.001, 'amount'), 0);
  for (const bad of [1e21, -1, NaN, Infinity, 'abc', '', null]) {
    assert.throws(() => requireAmount(bad, 'amount'), `rejects ${String(bad)}`);
  }
  assert.equal(amountInput(2).safeParse('10.456').data, 10.46);
  assert.equal(amountInput(2).safeParse(1e21).success, false);
  assert.equal(amountInput(4).safeParse('x').success, false);
});

test('document links allow only http(s) and app-relative paths', () => {
  assert.equal(requireSafeUrl('https://x.example/a.pdf', 'fileUrl'), 'https://x.example/a.pdf');
  assert.equal(requireSafeUrl('/api/storage/general/a.pdf', 'fileUrl'), '/api/storage/general/a.pdf');
  for (const bad of ['javascript:alert(1)', 'data:text/html,x', '//evil.example', 'vbscript:x', 'ftp://x', '', '/a\u0000b']) {
    assert.throws(() => requireSafeUrl(bad, 'fileUrl'), `rejects ${bad}`);
  }
});

test('dates must parse', () => {
  assert.ok(requireDate('2026-11-10', 'd') instanceof Date);
  assert.throws(() => requireDate('not-a-date', 'd'));
  assert.equal(validDateInput.safeParse('not-a-date').success, false);
  assert.equal(validDateInput.safeParse('2026-11-10').success, true);
});
