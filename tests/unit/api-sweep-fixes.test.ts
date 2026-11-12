import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = (path: string) => readFileSync(path, 'utf8');

test('display-settings and approval-webhook routes declare their boundary (they answered 403 to everyone)', () => {
  assert.match(source('src/app/api/ui-settings/sod-config/route.ts'), /permissions: \[RBAC_PERMISSIONS\.SOD_READ\]/);
  assert.match(source('src/app/api/ui-settings/table/route.ts'), /permissions: \[RBAC_PERMISSIONS\.DASHBOARD_READ\]/);
  assert.match(source('src/app/api/approvals/webhook/route.ts'), /\}, \{ publicRoute: true \}\); \/\/ authenticated by the signed action token/);
});

test('material summary report is grouped in the database, not summed in Node', () => {
  const svc = source('src/services/inventory/material-summary-report.service.ts');
  assert.match(svc, /GROUP BY s\."rtom"/);
  assert.doesNotMatch(svc, /sODMaterialUsage\.findMany/);
});

test('WIP revenue totals cover every order while the returned job list and issue list are capped', () => {
  const svc = source('src/services/finance/sod-wip-revenue.service.ts');
  assert.match(svc, /const MAX_WIP_ITEMS = 2000/);
  assert.match(svc, /const MAX_SNAPSHOT_ISSUES = 200/);
  assert.match(svc, /unbilledSodCount: unbilledCount/);
  assert.match(svc, /GROUP BY u\."serviceOrderId"/);
  assert.match(svc, /itemsTruncated/);
});

test('delay sheets narrow to possible delays in the database before applying the exact rules', () => {
  const svc = source('src/services/invoice/invoice.service.ts');
  assert.match(svc, /completedCondition: Prisma\.ServiceOrderWhereInput/);
  assert.match(svc, /delayReasonsRaw: \{ not: Prisma\.DbNull \}/);
});
