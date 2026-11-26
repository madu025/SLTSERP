import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const prisma = resolve(root, 'node_modules/.bin/prisma');
const tsx = resolve(root, 'node_modules/.bin/tsx');
const schema = resolve(root, 'prisma/schema');
const indexFile = resolve(root, 'prisma/post-push-indexes.sql');

function requireFile(path, label) {
  if (!existsSync(path)) {
    throw new Error(`Release artifact is missing: ${label}`);
  }
}

function run(command, args) {
  console.log(`[release] ${command} ${args.join(' ')}`);
  const result = spawnSync(command, args, {
    cwd: root,
    env: process.env,
    stdio: 'inherit',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${command} exited with status ${result.status ?? 'unknown'}`);
  }
}

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required for the production release job.');
}

requireFile(prisma, 'Prisma CLI');
requireFile(tsx, 'tsx runtime');
requireFile(schema, 'prisma/schema');
requireFile(indexFile, 'prisma/post-push-indexes.sql');

console.log('[release] applying Prisma migrations');
run(prisma, ['migrate', 'deploy']);

console.log('[release] applying non-Prisma indexes');
run(prisma, ['db', 'execute', '--schema', 'prisma/schema', '--file', 'prisma/post-push-indexes.sql']);

// The workflow seed rewrites every project workflow template and takes minutes. It only needs to run when one of its inputs changed:
// its own files, the catalogs it reads, or the schema (a new migration). The fingerprint of those inputs is kept in SystemSetting.
const WORKFLOW_SEED_INPUTS = [
  'prisma/seed-workflows.ts',
  'prisma/seed-project-approval-policies.ts',
  'src/config/project-type-catalog.ts',
  'src/config/workflow-policy.ts',
  'src/config/rbac-permissions.ts',
];
const FINGERPRINT_KEY = 'RELEASE_WORKFLOW_SEED_FINGERPRINT';

function workflowSeedFingerprint() {
  const hash = createHash('sha256');
  for (const file of WORKFLOW_SEED_INPUTS) hash.update(file).update(readFileSync(resolve(root, file)));
  hash.update(readdirSync(resolve(root, 'prisma/migrations')).sort().join('|'));
  return hash.digest('hex');
}

async function withPrisma(fn) {
  const { PrismaClient } = await import('@prisma/client');
  const client = new PrismaClient();
  try { return await fn(client); } finally { await client.$disconnect(); }
}

const fingerprint = workflowSeedFingerprint();
// any doubt (no row, a read error) runs the seed, as every release did before
const stored = await withPrisma((db) => db.systemSetting.findUnique({ where: { key: FINGERPRINT_KEY } })).catch(() => null);
if (stored?.value === fingerprint) {
  console.log('[release] workflow catalog inputs unchanged since the last release; seed skipped');
} else {
  console.log('[release] reconciling workflow catalog and approval snapshots');
  run(tsx, ['prisma/seed-workflows.ts']);
  await withPrisma((db) => db.systemSetting.upsert({ where: { key: FINGERPRINT_KEY }, update: { value: fingerprint }, create: { key: FINGERPRINT_KEY, value: fingerprint } }));
}

console.log('[release] reconciling canonical RBAC catalog and grants');
run(tsx, ['scripts/seed-rbac-capabilities.ts']);

console.log('[release] completed successfully');
