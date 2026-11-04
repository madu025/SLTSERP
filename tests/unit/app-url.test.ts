import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { getAppBaseUrl } from '../../src/lib/app-url';

test('base URL comes from the environment without a trailing slash, localhost when nothing is set', () => {
  const keep = { a: process.env.APP_BASE_URL, b: process.env.NEXT_PUBLIC_APP_URL, c: process.env.NEXTAUTH_URL };
  try {
    delete process.env.APP_BASE_URL; delete process.env.NEXT_PUBLIC_APP_URL; delete process.env.NEXTAUTH_URL;
    assert.equal(getAppBaseUrl(), 'http://localhost:3000');
    process.env.NEXT_PUBLIC_APP_URL = 'https://erp.example.lk/';
    assert.equal(getAppBaseUrl(), 'https://erp.example.lk');
    process.env.APP_BASE_URL = 'https://override.example.lk';
    assert.equal(getAppBaseUrl(), 'https://override.example.lk');
  } finally {
    for (const [k, v] of [['APP_BASE_URL', keep.a], ['NEXT_PUBLIC_APP_URL', keep.b], ['NEXTAUTH_URL', keep.c]] as const) {
      if (v === undefined) delete process.env[k]; else process.env[k] = v;
    }
  }
});

test('no source file falls back to the old vercel host when building links', () => {
  const offenders: string[] = [];
  const walk = (dir: string) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.(ts|tsx)$/.test(e.name) && !/app-url\.ts$|privacy/.test(p) && /\|\|\s*['"]https:\/\/sltserp\.vercel\.app['"]/.test(fs.readFileSync(p, 'utf8'))) offenders.push(path.relative(process.cwd(), p));
    }
  };
  walk(path.join(process.cwd(), 'src'));
  assert.deepEqual(offenders, []);
});
