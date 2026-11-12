import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = process.cwd();
const migration = fs.readFileSync(path.join(root, 'prisma/migrations/20261103000000_db_backed_project_approval_policies/migration.sql'), 'utf8');
const engine = fs.readFileSync(path.join(root, 'src/services/approval/process-gate-engine.ts'), 'utf8');
const adminService = fs.readFileSync(path.join(root, 'src/services/admin/process-gate.service.ts'), 'utf8');
const levelsRoute = fs.readFileSync(path.join(root, 'src/app/api/admin/process-gates/[id]/levels/route.ts'), 'utf8');
const workflowCleanup = fs.readFileSync(path.join(root, 'prisma/migrations/20261105000000_backfill_workflow_approval_canonical_snapshots/migration.sql'), 'utf8');
const workflowSeed = fs.readFileSync(path.join(root, 'prisma/seed-workflows.ts'), 'utf8');

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

test('workflow approval cleanup backfills canonical snapshots before seed verification', () => {
  assert.match(workflowCleanup, /UPDATE "WorkflowApprovalTemplate"/);
  assert.match(workflowCleanup, /project\.approve/);
  assert.match(workflowCleanup, /jsonb_build_array\(regexp_replace\(BTRIM\("role"\)/);
  assert.match(workflowCleanup, /incomplete canonical snapshots/);
  assert.match(workflowSeed, /RBAC_PERMISSIONS\.PROJECT_APPROVE/);
  assert.doesNotMatch(workflowSeed, /workflowPermissionForRole\(template\.role/);
});

test('the Head of Section gate names a real system role and repairs waiting approvals', () => {
  const migration = fs.readFileSync('prisma/migrations/20261116000000_fix_process_gate_role_codes/migration.sql', 'utf8');
  assert.match(migration, /'HEAD_OF_SECTION'/);
  assert.match(migration, /"status" = 'PENDING'/);
});

test('the gate wizard status catalogue lists every status the seeded gates use', () => {
  const catalogue = fs.readFileSync('src/config/process-gate-statuses.ts', 'utf8');
  for (const status of ['HOS_APPROVAL', 'MAIN_STORE_RELEASE', 'ISSUED', 'INPROGRESS']) {
    assert.match(catalogue, new RegExp(`value: '${status}'`));
  }
});

test('approvals go to the eligible role holder before any admin fallback', () => {
  const engine = fs.readFileSync('src/services/approval/process-gate-engine.ts', 'utf8');
  assert.match(engine, /candidates\.find\(\(user\) => hasEligibleCanonicalRole\(user, eligibleRoles\)\)\s*\?\? candidates\.find\(/);
});

test('a gate with work in flight cannot be switched off or moved, and unconnected modules are flagged', () => {
  const service = fs.readFileSync('src/services/admin/process-gate.service.ts', 'utf8');
  assert.match(service, /GATE_IN_USE/);
  assert.match(service, /universalApprovalInstance\.count\(\{ where: \{ policyId: id, status: 'PENDING' \}/);
  const modules = fs.readFileSync('src/config/process-gate-modules.ts', 'utf8');
  assert.match(modules, /\['MATERIAL_REQUEST', 'SERVICE_ORDER'\]/);
  assert.match(fs.readFileSync('src/app/admin/settings/process-gates/page.tsx', 'utf8'), /Not connected to a workflow/);
  assert.match(fs.readFileSync('src/app/admin/settings/process-gates/StepByStepGateWizard.tsx', 'utf8'), /isGateModuleConnected\(formData\.entityType\)/);
});
