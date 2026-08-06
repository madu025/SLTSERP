/**
 * One-off backfill: deduplicate MRN/MIN document numbers before the unique
 * index migration (prisma/migrations/20260806000000_mrn_issue_number_unique).
 *
 * For every document-number column:
 *   1. Reports NULL/missing rows and backfills them with `LEGACY-<id>`.
 *   2. Scans for duplicate values; keeps the oldest row (createdAt asc, id
 *      tiebreak) and suffixes later duplicates with `-DUP2`, `-DUP3`, ...
 *      (re-checking for collisions before each update).
 *   3. Reports counts and the live DB unique-index state.
 *
 * Usage: node scripts/backfill-mrn-issue-numbers.js [--apply]
 * Without --apply the script is dry-run (report only).
 */
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const APPLY = process.argv.includes('--apply');

const TARGETS = [
    { table: 'ContractorMaterialIssue', column: 'issueNumber', label: 'MIN (ContractorMaterialIssue.issueNumber)' },
    { table: 'ContractorMaterialReturn', column: 'returnNumber', label: 'MRN (ContractorMaterialReturn.returnNumber)' },
    { table: 'MRN', column: 'mrnNumber', label: 'MRN (MRN.mrnNumber)' },
    { table: 'StockIssue', column: 'issueNumber', label: 'ISS (StockIssue.issueNumber)' },
    { table: 'ProjectMaterialReturn', column: 'returnNumber', label: 'PMR (ProjectMaterialReturn.returnNumber)' },
];

async function columnExists(table, column) {
    const rows = await prisma.$queryRawUnsafe(
        `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2`,
        table, column
    );
    return rows.length > 0;
}

async function uniqueIndexExists(table, column) {
    const rows = await prisma.$queryRawUnsafe(
        `SELECT i.relname AS index_name
           FROM pg_class t
           JOIN pg_index ix ON t.oid = ix.indrelid
           JOIN pg_class i ON i.oid = ix.indexrelid
          WHERE t.relname = $1 AND ix.indisunique = true
            AND EXISTS (
                SELECT 1 FROM pg_attribute a
                 WHERE a.attrelid = t.oid
                   AND a.attnum = ANY(ix.indkey)
                   AND a.attname = $2
            )`,
        table, column
    );
    return rows.map(r => r.index_name);
}

async function processTarget(target, summary) {
    const { table, column, label } = target;
    console.log(`\n--- ${label} ---`);

    const exists = await columnExists(table, column);
    if (!exists) {
        console.log(`  Column "${column}" missing on "${table}" — migration will ADD it and backfill LEGACY values.`);
        summary.push({ label, note: 'column missing, migration handles it' });
        return;
    }

    const indexes = await uniqueIndexExists(table, column);
    console.log(`  Unique index: ${indexes.length > 0 ? indexes.join(', ') : 'NONE'}`);

    const total = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::int AS c FROM "${table}"`);
    const nulls = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::int AS c FROM "${table}" WHERE "${column}" IS NULL OR "${column}" = ''`);
    console.log(`  Rows: ${total[0].c} | NULL/empty ${column}: ${nulls[0].c}`);

    if (nulls[0].c > 0) {
        if (APPLY) {
            await prisma.$executeRawUnsafe(
                `UPDATE "${table}" SET "${column}" = 'LEGACY-' || "id" WHERE "${column}" IS NULL OR "${column}" = ''`
            );
            console.log(`  Backfilled ${nulls[0].c} NULL/empty values with LEGACY-<id>.`);
        } else {
            console.log(`  [DRY-RUN] Would backfill ${nulls[0].c} NULL/empty values with LEGACY-<id>.`);
        }
    }

    const dupes = await prisma.$queryRawUnsafe(
        `SELECT "${column}" AS value, COUNT(*)::int AS c FROM "${table}" WHERE "${column}" IS NOT NULL AND "${column}" <> '' GROUP BY "${column}" HAVING COUNT(*) > 1 ORDER BY c DESC`
    );
    console.log(`  Duplicate values: ${dupes.length}`);

    let renamed = 0;
    for (const dupe of dupes) {
        const rows = await prisma.$queryRawUnsafe(
            `SELECT id FROM "${table}" WHERE "${column}" = $1 ORDER BY "createdAt" ASC NULLS FIRST, id ASC`,
            dupe.value
        );
        // Keep the first (oldest) row; suffix the rest
        for (let i = 1; i < rows.length; i++) {
            let suffix = 2;
            let candidate = `${dupe.value}-DUP${suffix}`;
            // Avoid collisions with existing values
            for (;;) {
                const clash = await prisma.$queryRawUnsafe(
                    `SELECT COUNT(*)::int AS c FROM "${table}" WHERE "${column}" = $1`,
                    candidate
                );
                if (clash[0].c === 0) break;
                suffix += 1;
                candidate = `${dupe.value}-DUP${suffix}`;
            }
            console.log(`    ${dupe.value} -> row ${rows[i].id} renamed to ${candidate}`);
            if (APPLY) {
                await prisma.$executeRawUnsafe(
                    `UPDATE "${table}" SET "${column}" = $1 WHERE id = $2`,
                    candidate, rows[i].id
                );
            }
            renamed += 1;
        }
    }

    if (!APPLY && renamed > 0) {
        console.log(`  [DRY-RUN] Would rename ${renamed} duplicate rows.`);
    }
    summary.push({ label, rows: total[0].c, nulls: nulls[0].c, duplicateGroups: dupes.length, renamed });
}

(async () => {
    console.log(`Mode: ${APPLY ? 'APPLY' : 'DRY-RUN (pass --apply to write changes)'}`);
    const summary = [];
    for (const target of TARGETS) {
        await processTarget(target, summary);
    }
    console.log('\n=== SUMMARY ===');
    for (const row of summary) {
        console.log(JSON.stringify(row));
    }
    await prisma.$disconnect();
})().catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
});
