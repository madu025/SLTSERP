import { existsSync } from 'node:fs';
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

console.log('[release] reconciling workflow catalog and approval snapshots');
run(tsx, ['prisma/seed-workflows.ts']);

console.log('[release] reconciling canonical RBAC catalog and grants');
run(tsx, ['scripts/seed-rbac-capabilities.ts']);

console.log('[release] completed successfully');
