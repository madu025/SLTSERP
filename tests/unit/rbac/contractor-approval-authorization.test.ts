import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = (path: string) => readFileSync(path, 'utf8');

const page = source('src/app/contractors/management/approvals/page.tsx');
const actions = source('src/actions/contractor-actions.ts');
const lifecycle = source('src/services/contractor/contractor.lifecycle.service.ts');
const route = source('src/app/api/admin/contractors/route.ts');
const types = source('src/types/contractor/contractor.types.ts');

test('contractor approval UI cannot use local role or client approval identity fields', () => {
  assert.doesNotMatch(page, /localStorage/);
  assert.doesNotMatch(page, /userRole/);
  assert.doesNotMatch(page, /approverId|userId:/);
  assert.doesNotMatch(page, /armApprovedById|ospApprovedById/);
  assert.match(page, /approveContractorRegistration/);
  assert.match(page, /rejectContractorRegistration/);
  assert.match(page, /teamCodes:/);
});

test('server actions bind approval and rejection to the authenticated actor', () => {
  assert.match(actions, /const actor = await requirePermission\(RBAC_PERMISSIONS\.ADMIN_RBAC\)/g);
  assert.match(actions, /ContractorService\.approveContractor\(id, actor\.id/);
  assert.match(actions, /ContractorService\.rejectContractor\(id, actor\.id/);
  assert.doesNotMatch(actions, /armApprovedById|ospApprovedById|rejectionById|rejectedAt/);
});

test('approval service derives stage, audit fields, scope, and active canonical roles server-side', () => {
  assert.match(lifecycle, /getUserEffectivePermissions\(actorUserId\)/);
  assert.match(lifecycle, /RBAC_PERMISSIONS\.ADMIN_RBAC/);
  assert.match(lifecycle, /status: true,/);
  assert.match(lifecycle, /actor\.status !== 'active'/);
  assert.match(lifecycle, /resolveOpmcScope\(actorUserId\)/);
  assert.match(lifecycle, /systemRole: \{ select: \{ code: true, isActive: true \} \}/);
  assert.match(lifecycle, /sectionAssignments: \{ select: \{ role: \{ select: \{ code: true, isActive: true \} \} \} \}/);
  assert.match(lifecycle, /contractor\.status === 'ARM_PENDING'/);
  assert.match(lifecycle, /contractor\.status === 'OSP_PENDING'/);
  assert.match(lifecycle, /armApprovedById: actorUserId/);
  assert.match(lifecycle, /ospApprovedById: actorUserId/);
  assert.match(lifecycle, /rejectionById: actorUserId/);

  const genericUpdate = lifecycle.match(/static async updateContractor[\s\S]*?\n    \}\n\n    \/\*\*/)?.[0] ?? '';
  assert.doesNotMatch(genericUpdate, /armApprovedById|ospApprovedById|rejectionById|rejectedAt/);
});

test('admin contractor CRUD routes declare the canonical admin capability explicitly', () => {
  assert.equal((route.match(/permissions: \[RBAC_PERMISSIONS\.ADMIN_RBAC\]/g) ?? []).length, 4);
  assert.match(route, /apiHandler\(/);
});

test('generic contractor input types do not expose approval audit columns', () => {
  const updateType = types.match(/export interface ContractorUpdateData[\s\S]*?\n\}/)?.[0] ?? '';
  assert.doesNotMatch(updateType, /armApproved|ospApproved|rejectionById|rejectedAt/);
  assert.match(types, /export interface ContractorApprovalInput/);
  assert.match(types, /export interface ContractorRejectionInput/);
});

test('contractor portal never falls back to another contractor or an unscoped notification list', () => {
  const dashboard = source('src/services/contractor-portal/dashboard.service.ts');
  const qc = source('src/services/qc/qc-inspection.service.ts');
  assert.doesNotMatch(dashboard, /findFirst\(\{\s*where: \{ status: 'ACTIVE' \}/);
  assert.match(qc, /CONTRACTOR_CONTEXT_REQUIRED/);
  assert.match(qc, /teamIdsOf\(contractorId\)/);
  assert.match(qc, /if \(!contractorId\) return \{ notifications: \[\]/);
});

test('public contractor registration only stores safe document links and re-flags changed bank details', () => {
  const reg = source('src/services/contractor/contractor.registration.service.ts');
  assert.match(reg, /function safeDocumentUrl/);
  assert.match(reg, /INVALID_DOCUMENT_URL/);
  assert.match(reg, /bankChanged && onboarded \? \{ kycVerified: false \}/);
});
