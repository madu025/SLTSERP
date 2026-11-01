/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS preflight entrypoint. */
const fs = require('node:fs');
const path = require('node:path');

function fail(message) {
  console.error(`REAL_QA_PREFLIGHT_FAILED: ${message}`);
  process.exitCode = 1;
}

const required = [
  'QA_ENVIRONMENT',
  'QA_DATABASE_URL',
  'QA_BASE_URL',
  'QA_RESET_SCRIPT',
  'QA_FIXTURE_MANIFEST',
  'QA_MAKER_STORAGE',
  'QA_CHECKER_STORAGE',
];

for (const name of required) {
  if (!process.env[name]) fail(`${name} is required; real QA tests cannot silently fall back to mocks or production`);
}

if (process.env.QA_ENVIRONMENT !== 'disposable') {
  fail('QA_ENVIRONMENT must be exactly disposable');
}

function parseUrl(name) {
  const value = process.env[name];
  if (!value) return null;
  try {
    return new URL(value);
  } catch {
    fail(`${name} is not a valid URL`);
    return null;
  }
}

const qaDb = parseUrl('QA_DATABASE_URL');
const configuredDb = parseUrl('DATABASE_URL');
const qaBase = parseUrl('QA_BASE_URL');
const configuredApp = parseUrl('NEXT_PUBLIC_APP_URL');

if (qaDb && configuredDb && qaDb.href === configuredDb.href) {
  fail('QA_DATABASE_URL is identical to DATABASE_URL; production/development DB reuse is forbidden');
}
if (qaBase && configuredApp && qaBase.origin === configuredApp.origin) {
  fail('QA_BASE_URL is identical to NEXT_PUBLIC_APP_URL; production browser writes are forbidden');
}
if (qaDb && !['postgres:', 'postgresql:'].includes(qaDb.protocol)) {
  fail('QA_DATABASE_URL must use PostgreSQL');
}

for (const name of ['QA_RESET_SCRIPT', 'QA_FIXTURE_MANIFEST', 'QA_MAKER_STORAGE', 'QA_CHECKER_STORAGE']) {
  const resolved = path.resolve(process.cwd(), process.env[name] || '');
  if (!fs.existsSync(resolved)) fail(`${name} path does not exist: ${process.env[name] || '<empty>'}`);
}

if (process.exitCode) process.exit();

console.log('REAL_QA_PREFLIGHT_OK');
console.log(`databaseHost=${qaDb.hostname}`);
console.log(`baseOrigin=${qaBase.origin}`);
console.log('writePolicy=disposable QA database only; maker/checker browser storage required');
