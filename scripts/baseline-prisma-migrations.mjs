/**
 * Baseline an existing database that was historically managed with `prisma db push`.
 *
 * This records the migrations as already applied; it deliberately does not execute
 * their SQL. Run once only after verifying that the existing database matches the
 * current Prisma schema:
 *
 *   pnpm run db:migrate:baseline -- --confirm-existing-schema
 *
 * Future deployments must use `pnpm run db:migrate:deploy`.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const migrationsDir = path.join(root, 'prisma', 'migrations');

if (!process.argv.includes('--confirm-existing-schema')) {
    console.error('Refusing to baseline without --confirm-existing-schema.');
    console.error('Verify the existing database matches prisma/schema first.');
    process.exit(1);
}

const migrations = fs.readdirSync(migrationsDir, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && /^\d+_/.test(entry.name))
    .map(entry => entry.name)
    .sort();

if (migrations.length === 0) {
    console.error(`No Prisma migrations found in ${migrationsDir}`);
    process.exit(1);
}

const prismaBin = path.join(
    root,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'prisma.cmd' : 'prisma'
);

if (!fs.existsSync(prismaBin)) {
    console.error(`Prisma CLI not found at ${prismaBin}. Run pnpm install first.`);
    process.exit(1);
}

console.log(`Baselining ${migrations.length} Prisma migrations without executing migration SQL.`);
console.log('The existing schema and data will not be rewritten.');

for (const migration of migrations) {
    console.log(`\nMarking applied: ${migration}`);
    const result = spawnSync(
        prismaBin,
        ['migrate', 'resolve', '--applied', migration],
        {
            cwd: root,
            env: { ...process.env, PRISMA_HIDE_UPDATE_MESSAGE: '1' },
            stdio: 'inherit',
            shell: process.platform === 'win32',
            windowsHide: true
        }
    );

    if (result.error) {
        console.error(`Failed to execute Prisma for ${migration}: ${result.error.message}`);
        process.exit(1);
    }
    if (result.status !== 0) {
        console.error(`Failed to mark ${migration} as applied.`);
        process.exit(result.status ?? 1);
    }
}

console.log('\nBaseline complete. Future deploys must run: pnpm run db:migrate:deploy');
