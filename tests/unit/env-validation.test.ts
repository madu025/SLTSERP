import assert from 'node:assert/strict';
import { test } from 'node:test';
import { EnvValidationError, assertEnvironment, validateEnvironment } from '../../src/lib/env-validation';

const GOOD = {
  NODE_ENV: 'production',
  DATABASE_URL: 'postgresql://user:pw@db:5432/app',
  DIRECT_URL: 'postgresql://user:pw@db:5432/app',
  REDIS_URL: 'redis://:pw@redis:6379',
  JWT_SECRET: 'a'.repeat(48),
  CRON_SECRET: 'c'.repeat(32),
  APP_BASE_URL: 'https://example.org',
  S3_ENDPOINT: 'http://minio:9000',
  S3_BUCKET: 'b',
  S3_ACCESS_KEY: 'k',
  S3_SECRET_KEY: 's',
};
const NO_S3 = { S3_ENDPOINT: '', S3_BUCKET: '', S3_ACCESS_KEY: '', S3_SECRET_KEY: '' };
const silent = { warn: () => {}, error: () => {}, log: () => {} };
const names = (r: ReturnType<typeof validateEnvironment>, sev: 'error' | 'warn') => r.issues.filter((i) => i.severity === sev).map((i) => i.name);

test('a complete production configuration passes with no findings', () => {
  const r = validateEnvironment(GOOD);
  assert.equal(r.ok, true);
  assert.deepEqual(r.issues, []);
});

test('missing database, redis and jwt secret block a production start', () => {
  const r = validateEnvironment({ NODE_ENV: 'production' });
  assert.equal(r.ok, false);
  assert.deepEqual(names(r, 'error').sort(), ['DATABASE_URL', 'JWT_SECRET', 'REDIS_URL']);
});

test('URL shape is checked: a mysql or http value is rejected', () => {
  const r = validateEnvironment({ ...GOOD, DATABASE_URL: 'mysql://x', REDIS_URL: 'http://x' });
  assert.deepEqual(names(r, 'error').sort(), ['DATABASE_URL', 'REDIS_URL']);
});

test('a bad read replica URL blocks start, an unset one does not', () => {
  assert.deepEqual(names(validateEnvironment({ ...GOOD, READ_REPLICA_URL: 'nonsense' }), 'error'), ['READ_REPLICA_URL']);
  assert.equal(validateEnvironment({ ...GOOD, READ_REPLICA_URL: '' }).ok, true);
});

test('JWT secret: placeholder and very short values block, 16-31 characters only warn', () => {
  assert.deepEqual(names(validateEnvironment({ ...GOOD, JWT_SECRET: 'changeme' }), 'error'), ['JWT_SECRET']);
  assert.deepEqual(names(validateEnvironment({ ...GOOD, JWT_SECRET: 'x'.repeat(15) }), 'error'), ['JWT_SECRET']);
  const mid = validateEnvironment({ ...GOOD, JWT_SECRET: 'x'.repeat(20) });
  assert.equal(mid.ok, true);
  assert.deepEqual(names(mid, 'warn'), ['JWT_SECRET']);
});

test('optional production settings only warn', () => {
  const r = validateEnvironment({ ...GOOD, CRON_SECRET: '', APP_BASE_URL: '', DIRECT_URL: '' });
  assert.equal(r.ok, true);
  assert.deepEqual(names(r, 'warn').sort(), ['APP_BASE_URL', 'CRON_SECRET', 'DIRECT_URL']);
});

test('missing S3 settings only warn (uploads fail, the app still runs) and are skipped when local storage is allowed', () => {
  const r = validateEnvironment({ ...GOOD, ...NO_S3, STORAGE_REQUIRE_S3: 'true' });
  assert.equal(r.ok, true);
  assert.deepEqual(names(r, 'warn').sort(), ['S3_ACCESS_KEY', 'S3_BUCKET', 'S3_ENDPOINT', 'S3_SECRET_KEY']);
  assert.deepEqual(names(validateEnvironment({ ...GOOD, ...NO_S3, STORAGE_ALLOW_LOCAL_FALLBACK: 'true' }), 'warn'), []);
});

test('outside production nothing blocks startup', () => {
  const r = validateEnvironment({ NODE_ENV: 'development' });
  assert.equal(r.ok, true);
  assert.ok(names(r, 'warn').includes('DATABASE_URL'));
});

test('assertEnvironment throws a named error without ever printing secret values', () => {
  const lines: string[] = [];
  const log = { warn: (m: string) => lines.push(m), error: (m: string) => lines.push(m), log: (m: string) => lines.push(m) };
  const env = { ...GOOD, JWT_SECRET: 'supersecret-pw', DATABASE_URL: 'mysql://user:topsecretpw@db/app' };
  assert.throws(() => assertEnvironment(env, log), (e: unknown) => {
    assert.ok(e instanceof EnvValidationError);
    assert.ok(e.message.includes('DATABASE_URL') && e.message.includes('JWT_SECRET'));
    return true;
  });
  const output = lines.join('\n') + (() => { try { assertEnvironment(env, silent); return ''; } catch (e) { return (e as Error).message; } })();
  assert.ok(!output.includes('topsecretpw'));
  assert.ok(!output.includes('supersecret-pw'));
});

test('SKIP_ENV_VALIDATION=true lets an invalid configuration start and says so', () => {
  const lines: string[] = [];
  const log = { warn: () => {}, error: (m: string) => lines.push(m), log: () => {} };
  const r = assertEnvironment({ NODE_ENV: 'production', SKIP_ENV_VALIDATION: 'true' }, log);
  assert.equal(r.ok, false);
  assert.ok(lines.some((l) => l.includes('SKIP_ENV_VALIDATION')));
});
