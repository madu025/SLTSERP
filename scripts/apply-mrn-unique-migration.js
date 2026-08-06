/**
 * Applies prisma/migrations/20260806000000_mrn_issue_number_unique/migration.sql
 * directly against the configured DATABASE_URL.
 *
 * Rationale: this repository's database is not managed by `prisma migrate`
 * (no _prisma_migrations bookkeeping; schema drift baseline via db push).
 * The migration SQL is fully idempotent (IF NOT EXISTS / guarded UPDATEs),
 * so direct execution is safe and matches the repo's hand-rolled migration
 * folder convention.
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

(async () => {
    const sqlPath = path.join(__dirname, '..', 'prisma', 'migrations', '20260806000000_mrn_issue_number_unique', 'migration.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    const statements = sql
        .split(/;\s*\n/)
        .map(s => s.replace(/--[^\n]*/g, '').trim())
        .filter(s => s.length > 0);

    for (const statement of statements) {
        const head = statement.split('\n').find(l => l.trim().length > 0) || '';
        await prisma.$executeRawUnsafe(statement);
        console.log(`OK: ${head.trim().slice(0, 90)}`);
    }

    // Verification: unique indexes + NOT NULL constraints present
    const indexes = await prisma.$queryRawUnsafe(
        `SELECT t.relname AS table_name, i.relname AS index_name
           FROM pg_class t
           JOIN pg_index ix ON t.oid = ix.indrelid
           JOIN pg_class i ON i.oid = ix.indexrelid
          WHERE ix.indisunique = true
            AND t.relname IN ('ContractorMaterialIssue','ContractorMaterialReturn','MRN','StockIssue','ProjectMaterialReturn')
            AND i.relname IN (
                'ContractorMaterialIssue_issueNumber_key',
                'ContractorMaterialReturn_returnNumber_key',
                'MRN_mrnNumber_key',
                'StockIssue_issueNumber_key',
                'ProjectMaterialReturn_returnNumber_key'
            )
          ORDER BY t.relname`
    );
    console.log('\nVerified unique indexes:');
    for (const ix of indexes) {
        console.log(`  ${ix.table_name} -> ${ix.index_name}`);
    }

    const notNull = await prisma.$queryRawUnsafe(
        `SELECT table_name, column_name, is_nullable
           FROM information_schema.columns
          WHERE (table_name = 'ContractorMaterialIssue' AND column_name = 'issueNumber')
             OR (table_name = 'ContractorMaterialReturn' AND column_name = 'returnNumber')`
    );
    console.log('NOT NULL verification:');
    for (const col of notNull) {
        console.log(`  ${col.table_name}.${col.column_name} nullable=${col.is_nullable}`);
    }

    await prisma.$disconnect();
})().catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
});
