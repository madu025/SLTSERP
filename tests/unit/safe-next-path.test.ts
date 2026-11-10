import assert from 'node:assert/strict';
import { test } from 'node:test';
import { safeNextPath } from '../../src/lib/safe-next-path';

test('keeps same-origin paths with query strings', () => {
  assert.equal(safeNextPath('/projects/abc'), '/projects/abc');
  assert.equal(safeNextPath('/projects/abc?tab=finance&x=1'), '/projects/abc?tab=finance&x=1');
});

test('anything that could leave the site falls back to the dashboard', () => {
  for (const bad of ['https://evil.example', '//evil.example', '/\\evil.example', 'projects', '', null, undefined, '/a\r\nSet-Cookie: x=1', '/a\0b']) {
    assert.equal(safeNextPath(bad as string | null | undefined), '/dashboard', String(bad));
  }
});
