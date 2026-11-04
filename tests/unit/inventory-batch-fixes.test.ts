import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { createReturnSchema } from '../../src/lib/validations/project-stock.schema';
import { materialIssueSchema } from '../../src/lib/validations/inventory.schema';

// Real ids from this database: UUIDv7-style, not RFC 4122 variant, so zod's strict .uuid() rejects them.
const DB_ID = '01a1a542-edbe-9235-4197-461a15271bdf';

test('project return accepts the database ids (it used to answer "Approved source issue is required")', () => {
  const r = createReturnSchema.safeParse({ projectId: DB_ID, storeId: DB_ID, issueId: DB_ID, items: [{ itemId: DB_ID, quantity: 3, condition: 'GOOD' }] });
  assert.ok(r.success, JSON.stringify(r.success ? '' : r.error.issues));
});

test('contractor issue keeps the serial numbers instead of stripping them', () => {
  const r = materialIssueSchema.safeParse({ contractorId: DB_ID, storeId: DB_ID, month: '2026-11', items: [{ itemId: DB_ID, quantity: 2, serials: ['SN-1', 'SN-2'] }] });
  assert.ok(r.success);
  if (r.success) assert.deepEqual(r.data.items[0].serials, ['SN-1', 'SN-2']);
});

test('no route or schema validates an id with the strict z.string().uuid() (use databaseUuidSchema)', () => {
  const offenders: string[] = [];
  const walk = (dir: string) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.(ts|tsx)$/.test(e.name) && /z\.string\(\)\.uuid\(/.test(fs.readFileSync(p, 'utf8'))) offenders.push(path.relative(process.cwd(), p));
    }
  };
  walk(path.join(process.cwd(), 'src'));
  assert.deepEqual(offenders, []);
});

test('MRN approval never upserts a negative stock row (the BEFORE INSERT trigger rejects it)', () => {
  const src = fs.readFileSync(path.join(process.cwd(), 'src/services/inventory/mrn.service.ts'), 'utf8');
  assert.ok(!/create:\s*\{[^}]*quantity:\s*-/.test(src));
});

test('stock request transfers record InventoryTransaction.referenceId as the request id (a UUID column)', () => {
  const src = fs.readFileSync(path.join(process.cwd(), 'src/services/inventory/stock-request.service.ts'), 'utf8');
  const bad = [...src.matchAll(/createTransaction\(\{[^}]*?referenceId:\s*stockReq\.requestNr/gs)];
  assert.equal(bad.length, 0);
});
