import assert from 'node:assert/strict';
import { test } from 'node:test';

// The service imports prisma; stub the module graph by testing the pure helper through a dynamic import guard.
test('holdsRole matches exact, _GLOBAL and section-prefixed role codes only', async () => {
  process.env.DATABASE_URL ||= 'postgresql://user:pass@localhost:5432/test';
  const { holdsRole } = await import('../../src/services/project/project-next-action.service');
  assert.equal(holdsRole(['OSP_MANAGER'], 'OSP_MANAGER'), true);
  assert.equal(holdsRole(['OSP_MANAGER_GLOBAL'], 'OSP_MANAGER'), true);
  assert.equal(holdsRole(['NEW_CONNECTION_OSP_MANAGER'], 'OSP_MANAGER'), true);
  assert.equal(holdsRole(['ENGINEER'], 'OSP_MANAGER'), false);
  // MANAGER must not be treated as OSP_MANAGER, and a longer unrelated suffix must not match.
  assert.equal(holdsRole(['MANAGER'], 'OSP_MANAGER'), false);
  assert.equal(holdsRole(['OSP_ENGINEER'], 'ENGINEER'), true);
  assert.equal(holdsRole(['XENGINEER'], 'ENGINEER'), false);
  assert.equal(holdsRole([], 'ENGINEER'), false);
  assert.equal(holdsRole(['ENGINEER'], ''), false);
});
