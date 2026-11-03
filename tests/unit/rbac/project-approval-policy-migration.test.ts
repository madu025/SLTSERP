import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  getChangeRequestPolicyVariant,
  hasEligiblePolicyRole,
  parseEligibleRoles,
} from '@/services/project/project-approval-policy.service';

const boqService = readFileSync('src/services/project/project-boq-approval.service.ts', 'utf8');
const changeService = readFileSync('src/services/project/change-request.service.ts', 'utf8');
const schema = readFileSync('prisma/schema/dynamic-policy.prisma', 'utf8');
const migration = readFileSync('prisma/migrations/20261103000000_db_backed_project_approval_policies/migration.sql', 'utf8');
const cleanupMigration = readFileSync('prisma/migrations/20261104000000_canonical_change_approvals_and_drop_notification_role_snapshot/migration.sql', 'utf8');
const seed = readFileSync('prisma/seed-project-approval-policies.ts', 'utf8');

test('amount bands preserve the existing change-request thresholds', () => {
  assert.equal(getChangeRequestPolicyVariant(0), 'UNDER_100K');
  assert.equal(getChangeRequestPolicyVariant(99_999.99), 'UNDER_100K');
  assert.equal(getChangeRequestPolicyVariant(100_000), 'FROM_100K_TO_500K');
  assert.equal(getChangeRequestPolicyVariant(499_999.99), 'FROM_100K_TO_500K');
  assert.equal(getChangeRequestPolicyVariant(500_000), 'OVER_500K');
});

test('DB eligible role data is normalized and inactive roles cannot pass', () => {
  assert.deepEqual(parseEligibleRoles(['AREA_MANAGER_GLOBAL', 'ENGINEER']), ['AREA_MANAGER', 'ENGINEER']);
  assert.equal(hasEligiblePolicyRole([{ code: 'AREA_MANAGER_GLOBAL', isActive: true }], ['AREA_MANAGER']), true);
  assert.equal(hasEligiblePolicyRole([{ code: 'AREA_MANAGER', isActive: false }], ['AREA_MANAGER']), false);
  assert.equal(hasEligiblePolicyRole([{ code: 'FINANCE_MANAGER', isActive: true }], ['AREA_MANAGER']), false);
});

test('BOQ and change-request services consume DB policy data, not ROLE_GROUPS', () => {
  assert.doesNotMatch(boqService, /ROLE_GROUPS|allowedRolesByStep/);
  assert.match(boqService, /getBoqApprovalLevel\(step\)/);
  assert.match(boqService, /hasEligiblePolicyRole\(roles, level\.eligibleRoles\)/);
  assert.match(changeService, /getChangeRequestApprovalPolicy\(policyVariant\)/);
  assert.match(changeService, /policyId: policy\.id/);
  assert.match(changeService, /policyVariant/);
  assert.doesNotMatch(changeService, /ROLE_GROUPS|APPROVAL_CHAIN/);
});

test('schema and migration persist capability, branch, and policy snapshots', () => {
  assert.match(schema, /policyVariant\s+String\s+@default\("DEFAULT"\)/);
  assert.match(schema, /requiredPermission\s+String\?/);
  assert.match(schema, /eligibleRoles\s+Json\?/);
  assert.match(schema, /@@unique\(\[gatePolicyId, policyVariant, level\]\)/);
  assert.match(migration, /PROJECT_BOQ_APPROVAL/);
  assert.match(migration, /PROJECT_CHANGE_REQUEST/);
  assert.match(migration, /project\.approve/);
  assert.match(migration, /UNDER_100K/);
  assert.match(migration, /FROM_100K_TO_500K/);
  assert.match(migration, /OVER_500K/);
});

test('change approvals authorize from canonical snapshots before legacy cleanup', () => {
  assert.match(schema, /requiredPermission\s+String\?/);
  assert.match(schema, /eligibleRoles\s+Json\?/);
  assert.match(cleanupMigration, /ALTER TABLE "ChangeApproval"/);
  assert.match(cleanupMigration, /incomplete_change_approvals/);
  assert.match(changeService, /approval\.requiredPermission/);
  assert.match(changeService, /hasEligiblePolicyRole\(actorRoles, approval\.eligibleRoles\)/);
  assert.doesNotMatch(changeService, /actorRoles\.includes\(requiredRole\)/);
});

test('workflow seed refuses partial branches instead of overwriting policy edits', () => {
  assert.match(seed, /existingCount === 0/);
  assert.match(seed, /existingCount !== levels\.length/);
  assert.match(seed, /refusing to overwrite administrator configuration/);
});
