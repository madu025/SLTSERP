import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const page = readFileSync('src/app/dashboard/page.tsx', 'utf8');

test('dashboard default tab is selected from canonical permissions, not legacy role groups', () => {
  assert.match(page, /export const getDefaultTabForPermissions/);
  assert.match(page, /RBAC_PERMISSIONS\.REPORTS_MANAGER_READ/);
  assert.match(page, /RBAC_PERMISSIONS\.REPORTS_AREA_READ/);
  assert.match(page, /RBAC_PERMISSIONS\.PROCUREMENT_READ/);
  assert.match(page, /RBAC_PERMISSIONS\.INVENTORY_READ/);
  assert.match(page, /RBAC_PERMISSIONS\.FINANCE_READ/);
  assert.match(page, /RBAC_PERMISSIONS\.PROJECT_READ/);
  assert.match(page, /getDefaultTabForPermissions\(user\?\.permissions\)/);
  assert.doesNotMatch(page, /ROLE_GROUPS|hasRole\(|getDefaultTabForRole/);
});

test('contractor and stores redirects follow capabilities (landingPath), not role names', () => {
  assert.ok(page.includes('landingPath(user.permissions)'));
  assert.doesNotMatch(page, /isContractorRole|STORES_MANAGER/);
  assert.ok(page.includes('router.push(landing)'));
});
