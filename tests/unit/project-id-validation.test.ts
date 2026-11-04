import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { databaseUuidSchema } from '../../src/lib/validations/uuid.schema';

// Database ids come from uuid_generate_v7() and often fail Zod 4's strict RFC version/variant check.
const REAL_DATABASE_IDS = [
  '01a1a26e-5ee5-f6b9-a1db-7b9e4f95c417',
  '01a17ce3-0642-6e50-7446-29cfffba856a',
];

test('database id schema accepts ids produced by uuid_generate_v7()', () => {
  for (const id of REAL_DATABASE_IDS) {
    assert.equal(databaseUuidSchema.safeParse(id).success, true, id);
  }
  assert.equal(databaseUuidSchema.safeParse('not-an-id').success, false);
});

test('project API routes and schemas never use the strict z.string().uuid() on record ids', () => {
  const roots = [path.resolve(process.cwd(), 'src/app/api/projects'), path.resolve(process.cwd(), 'src/lib/validations/project-stock.schema.ts')];
  const files = (target: string): string[] => {
    if (target.endsWith('.ts')) return [target];
    return readdirSync(target, { withFileTypes: true }).flatMap((entry) => {
      const entryPath = path.join(target, entry.name);
      return entry.isDirectory() ? files(entryPath) : /\.ts$/.test(entry.name) ? [entryPath] : [];
    });
  };
  const violations = roots.flatMap(files).filter((file) => /z\.string\(\)\.uuid\(\)/.test(readFileSync(file, 'utf8')));
  assert.deepEqual(violations.map((file) => path.relative(process.cwd(), file)), [], 'use databaseUuidSchema for record ids');
});
