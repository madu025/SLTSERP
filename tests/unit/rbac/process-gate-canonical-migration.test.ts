import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = process.cwd();
const migration = fs.readFileSync(path.join(root, 'prisma/migrations/20261103000000_db_backed_project_approval_policies/migration.sql'), 'utf8');
const engine = fs.readFileSync(path.join(root, 'src/services/approval/process-gate-engine.ts'), 'utf8');
const adminService = fs.readFileSync(path.join(root, 'src/services/admin/process-gate.service.ts'), 'utf8');
const levelsRoute = fs.readFileSync(path.join(root, 'src/app/api/admin/process-gates/[id]/levels/route.ts'), 'utf8');

test('process-gate migration preserves existing policy levels', () => {
  assert.doesNotMatch(migration, /DELETE\s+FROM\s+"ProcessApprovalLevel"/i);
  assert.match(migration, /ON CONFLICT \("gatePolicyId", "policyVariant", "level"\) DO NOTHING/);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS "requiredPermission"/);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS "notificationAudience"/);
});

test('generic process-gate runtime is canonical and fail-closed', () => {
  assert.doesNotMatch(engine, /canonicalApproverWhere/);
  assert.match(engine, /assertCanonicalLevel/);
  assert.match(engine, /requiredPermission/);
  assert.match(engine, /findCanonicalApprover\(tx as unknown as Prisma\.TransactionClient, nextLevel\)/);
  assert.match(engine, /instance\.requiredPermission \?\? currentPolicyLevel\?\.requiredPermission/);
  assert.doesNotMatch(adminService, /update:\s*gateData/);
  assert.match(adminService, /refusing to overwrite/);
});

test('process-gate levels API requires canonical capability and eligible roles', () => {
  assert.match(levelsRoute, /requiredPermission: z\.string\(\)/);
  assert.match(levelsRoute, /eligibleRoles: z\.array/);
});
