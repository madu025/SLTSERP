import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { compare, monthBounds } from '../../src/services/core/company-health.service';

test('compare gives a percentage change and no fake base when the previous value is zero', () => {
  assert.equal(compare(150, 100).changePct, 50);
  assert.equal(compare(50, 100).changePct, -50);
  assert.equal(compare(10, 0).changePct, null);
  assert.equal(compare(-50, -100).changePct, 50);
});

test('monthBounds returns the current and previous calendar month in UTC', () => {
  const b = monthBounds(new Date('2026-01-15T10:00:00Z'));
  assert.equal(b.currentStart.toISOString(), '2026-01-01T00:00:00.000Z');
  assert.equal(b.previousStart.toISOString(), '2025-12-01T00:00:00.000Z');
  assert.equal(b.previousEnd.toISOString(), '2025-12-31T23:59:59.999Z');
  assert.equal(b.yearStart.toISOString(), '2026-01-01T00:00:00.000Z');
  // 14.4 days into January -> the comparison window is the first 14.4 days of December
  assert.equal(b.previousSameSpanEnd.toISOString(), '2025-12-15T10:00:00.000Z');
  // late in a long month the window is capped at the end of the previous (shorter) month
  const feb = monthBounds(new Date('2026-03-31T00:00:00Z'));
  assert.equal(feb.previousSameSpanEnd.toISOString(), feb.previousEnd.toISOString());
});

test('company health endpoint is management-only and sections are gated per module capability', () => {
  const route = fs.readFileSync('src/app/api/dashboard/company-health/route.ts', 'utf8');
  assert.match(route, /REPORTS_MANAGER_READ/);
  assert.match(route, /ADMIN_RBAC/);
  const svc = fs.readFileSync('src/services/core/company-health.service.ts', 'utf8');
  for (const p of ['FINANCE_READ', 'SOD_READ', 'PROJECT_READ', 'FLEET_READ', 'HELPDESK_READ', 'INVENTORY_READ']) {
    assert.ok(svc.includes(`has(RBAC_PERMISSIONS.${p})`), p);
  }
});

test('management alerts run daily, are wired end to end, and are de-duplicated per exception per day', () => {
  const svc = fs.readFileSync('src/services/notification/management-alerts.service.ts', 'utf8');
  assert.match(svc, /audience: 'ADMINISTRATORS'/);
  assert.match(svc, /dedupKey: `management-alert:\$\{e\.id\}:\$\{day\(now\)\}`/);
  assert.match(svc, /severity !== 'info'/);
  assert.match(fs.readFileSync('src/services/service-order/sync/types.ts', 'utf8'), /'MANAGEMENT_ALERTS'/);
  assert.match(fs.readFileSync('src/services/service-order/sod.sync.service.ts', 'utf8'), /name: 'management-alerts', type: 'MANAGEMENT_ALERTS', at: '07:45'/);
  assert.match(fs.readFileSync('src/workers/system.worker.ts', 'utf8'), /MANAGEMENT_ALERTS: async/);
});
