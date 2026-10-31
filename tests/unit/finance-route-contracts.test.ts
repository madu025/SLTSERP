import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const source = (path: string) => readFileSync(path, 'utf8');

test('year-end close uses authenticated identity and canonical approval capability', () => {
  const route = source('src/app/api/finance/period-close/route.ts');
  assert.match(route, /params\._userId/);
  assert.match(route, /RBAC_PERMISSIONS\.FINANCE_APPROVE/);
  assert.match(route, /resolveOpmcScope\(params\._userId\)/);
  assert.doesNotMatch(route, /x-user-id|ROLE_GROUPS/);
});

test('contractor invoice approval does not trust a request user header', () => {
  const route = source('src/app/api/finance/invoices/[id]/approve/route.ts');
  assert.match(route, /params\._userId/);
  assert.doesNotMatch(route, /x-user-id/);
});

test('bank reconciliation page never substitutes zero balances on fetch failure', () => {
  const page = source('src/app/finance/bank/reconciliation/page.tsx');
  assert.match(page, /if \(!res\.ok\) throw/);
  assert.doesNotMatch(page, /bankAccountId: 'default'|isReconciled: true/);
});

test('global bank reconciliation route rejects scoped readers and writers', () => {
  const route = source('src/app/api/finance/bank/reconciliation/route.ts');
  assert.equal((route.match(/resolveOpmcScope\(params\._userId\)/g) || []).length, 2);
  assert.match(route, /RBAC_PERMISSIONS\.FINANCE_READ/);
  assert.match(route, /RBAC_PERMISSIONS\.FINANCE_APPROVE/);
});

test('credit note route validates the authenticated actor and monetary payload', () => {
  const route = source('src/app/api/finance/credit-notes/route.ts');
  assert.match(route, /params\._userId/);
  assert.match(route, /z\.number\(\)\.finite\(\)\.positive/);
  assert.match(route, /RBAC_PERMISSIONS\.FINANCE_APPROVE/);
  assert.doesNotMatch(route, /x-user-id|ROLE_GROUPS/);
});
