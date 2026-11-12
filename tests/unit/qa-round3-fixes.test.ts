import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const src = (p: string) => fs.readFileSync(p, 'utf8');

test('reports include reversed originals so a reversal nets to zero', () => {
  assert.match(src('src/services/finance/ledger-report.service.ts'), /status: \{ in: \['POSTED', 'REVERSED'\] \}/);
  assert.doesNotMatch(src('src/services/finance/tax.service.ts'), /status: \{ not: 'REVERSED' \}/);
  assert.doesNotMatch(src('src/services/finance/ar-ap.service.ts'), /status: \{ not: 'REVERSED' \}/);
});

test('petty cash compares balances as Decimals', () => {
  assert.match(src('src/services/finance/petty-cash.service.ts'), /Decimal\(account\.currentBalance\)\.lt\(/);
});

test('profile never returns credential material', () => {
  const s = src('src/services/hr/user.service.ts');
  assert.match(s, /password: _password, securityAnswer: _securityAnswer, tokenVersion: _tokenVersion/);
});

test('audit trail redacts credentials and notification read is owner-scoped', () => {
  assert.match(src('src/services/core/system.service.ts'), /securityanswer/);
  assert.match(src('src/services/notification/index.ts'), /updateMany\(\{ id, userId \}/);
});

test('stock request actions are state-guarded and role-checked', () => {
  const s = src('src/services/inventory/stock-request.service.ts');
  assert.match(s, /assertActorEligibleForGateLevel/);
  assert.match(s, /REQUEST_ALREADY_ACTIONED/);
  assert.match(s, /only pending requests can be returned/);
});

test('no admin.super through role payloads or user permission overrides', () => {
  assert.match(src('src/services/admin/role.service.ts'), /item === 'admin\.super'/);
  assert.match(src('src/app/api/admin/users/[userId]/permissions/route.ts'), /cannot grant permissions you do not hold/);
});

test('SF audit config is guarded by finance.audit', () => {
  assert.match(src('src/app/api/finance/sf-audit/mapping-config/route.ts'), /FINANCE_AUDIT/);
  assert.match(src('src/app/api/finance/sf-audit/payment-split-config/route.ts'), /FINANCE_AUDIT/);
});
