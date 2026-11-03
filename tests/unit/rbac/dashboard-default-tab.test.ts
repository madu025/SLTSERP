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

test('contractor and stores redirects remain role-scoped outside default-tab selection', () => {
  assert.match(page, /isContractorRole\(user\.role\)/);
  assert.match(page, /STORES_MANAGER.*STORES_ASSISTANT/);
  assert.match(page, /router\.push\("\/contractor\/dashboard"\)/);
  assert.match(page, /router\.push\("\/inventory"\)/);
});
