import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { findSodConflicts, isPrivileged, activityState, passwordAgeDays, isBackdated, samePerson, SOD_CONFLICTS, BREACH_LABEL, type ControlSummary } from '../../src/lib/control-shared';
import { buildControlExceptions } from '../../src/services/control/control-exceptions';

const now = new Date('2026-11-14T08:00:00Z');
const read = (p: string) => fs.readFileSync(p, 'utf8');

test('findSodConflicts: a user holding both sides of a pair is flagged, one side alone is not', () => {
  assert.deepEqual(findSodConflicts(['finance.write']), []);
  assert.deepEqual(findSodConflicts(['finance.write', 'finance.approve']).map((c) => c.id), ['finance-write-approve']);
  const many = findSodConflicts(['finance.write', 'finance.approve', 'finance.audit', 'inventory.write', 'inventory.approve']).map((c) => c.id);
  assert.ok(many.includes('audit-finance-write') && many.includes('inventory-write-approve'));
  assert.ok(SOD_CONFLICTS.every((c) => c.a !== c.b));
});

test('isPrivileged recognises admin.super and admin.rbac only', () => {
  assert.equal(isPrivileged(['admin.rbac']), true);
  assert.equal(isPrivileged(['admin.super']), true);
  assert.equal(isPrivileged(['finance.approve']), false);
});

test('activityState: never, dormant and active', () => {
  assert.equal(activityState(null, now), 'NEVER');
  assert.equal(activityState('2026-11-01T00:00:00Z', now), 'ACTIVE');
  assert.equal(activityState('2026-08-01T00:00:00Z', now), 'DORMANT');
  assert.equal(activityState('2026-09-15T00:00:00Z', now, 30), 'DORMANT');
});

test('passwordAgeDays is null when never recorded', () => {
  assert.equal(passwordAgeDays(null, now), null);
  assert.equal(passwordAgeDays('2026-11-04T08:00:00Z', now), 10);
});

test('isBackdated compares calendar months, not days', () => {
  assert.equal(isBackdated('2026-11-01', '2026-11-14T08:00:00Z'), false);
  assert.equal(isBackdated('2026-10-31', '2026-11-01T01:00:00Z'), true);
  assert.equal(isBackdated('2025-12-31', '2026-01-02T00:00:00Z'), true);
});

test('samePerson never matches missing ids', () => {
  assert.equal(samePerson('a', 'a'), true);
  assert.equal(samePerson('a', 'b'), false);
  assert.equal(samePerson(null, null), false);
  assert.equal(samePerson('a', undefined), false);
});

const clean: ControlSummary = { breaches30d: 0, voucherSelfPaid30d: 0, overridePrivileged: 0, sodConflictUsers: 0, neverLoggedIn: 0, dormant: 0, failedLogins7d: 0, approvalsOverSla: 0, oldestApprovalDays: null, hashBreaks: 0, openPastPeriods: 0, bankBacklogOver30: 0, backdated30d: 0 };

test('control exceptions: a clean summary raises nothing', () => {
  assert.deepEqual(buildControlExceptions(clean), []);
});

test('control exceptions: severities and the voucher/other split', () => {
  const ex = buildControlExceptions({ ...clean, breaches30d: 5, voucherSelfPaid30d: 2, overridePrivileged: 1, failedLogins7d: 25, dormant: 3, oldestApprovalDays: 20, hashBreaks: 2, openPastPeriods: 1 });
  const by = Object.fromEntries(ex.map((e) => [e.id, e]));
  assert.equal(by['ctl-voucher-selfpaid'].severity, 'critical');
  assert.match(by['ctl-sod-breaches'].detail, /^3 record/);
  assert.equal(by['ctl-override-priv'].severity, 'warning');
  assert.equal(by['ctl-failed-logins'].severity, 'warning');
  assert.equal(by['ctl-dormant'].severity, 'info');
  assert.equal(by['ctl-hash-chain'].severity, 'warning');
  assert.equal(by['ctl-period-open'].severity, 'warning');
  assert.equal(by['ctl-approval-ageing'].severity, 'warning');
  assert.ok(ex.every((e) => e.area === 'Controls' && e.href === '/admin/control'));
  // fewer than 20 failed sign-ins is noise
  assert.equal(buildControlExceptions({ ...clean, failedLogins7d: 19 }).length, 0);
});

test('every breach kind has a label', () => {
  for (const k of ['VOUCHER_APPROVED_AND_PAID', 'VOUCHER_SELF_APPROVED', 'VOUCHER_NO_CREATOR', 'PO_SELF_APPROVED', 'PETTY_CASH_SELF_APPROVED'] as const) assert.ok(BREACH_LABEL[k]);
});

test('control wiring: migration, login history, audit capture, monthly close, permissions', () => {
  const mig = read('prisma/migrations/20261125000000_login_history_and_audit_index/migration.sql');
  for (const col of ['lastLoginAt', 'passwordChangedAt', 'failedLoginCount', 'lockedUntil']) assert.match(mig, new RegExp(`ADD COLUMN IF NOT EXISTS "${col}"`));
  assert.match(mig, /CREATE TABLE IF NOT EXISTS "LoginEvent"/);
  assert.match(mig, /AuditLog_action_createdAt_idx/);

  const login = read('src/app/api/login/route.ts');
  assert.match(login, /recordSuccess/);
  assert.match(login, /recordFailure/);

  const handler = read('src/lib/api-handler.ts');
  assert.match(handler, /captureOld/);
  assert.match(handler, /entityIdParam/);
  const perm = read('src/app/api/admin/users/[userId]/permissions/route.ts');
  assert.match(perm, /entityIdParam: 'userId'/);
  assert.match(perm, /captureOld/);

  const month = read('src/app/api/finance/period-close/month/route.ts');
  assert.match(month, /FINANCE_APPROVE/);
  assert.match(month, /LOCKED/);
  assert.match(month, /audit:/);

  const control = read('src/app/api/admin/control/route.ts');
  assert.match(control, /ADMIN_RBAC/);
  assert.match(control, /resolveOpmcScope/, 'company-wide only');
  assert.doesNotMatch(read('src/services/control/access-risk.service.ts'), /prisma\.\w+\.(update|delete|create)\(/, 'the access report never changes data');
  assert.doesNotMatch(read('src/services/control/sod-breach.service.ts'), /prisma\.\w+\.(update|delete|create)\(/, 'the breach report never changes data');
});
