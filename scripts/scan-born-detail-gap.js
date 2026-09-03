/* READ-ONLY: size the born-row detail gap — terminal SODs with null detail
 * fields that the SLT API completed record could null-fill. */
const { q, disconnect } = require('./lib/db-with-retry');

async function main() {
    const counts = await q(p => p.$queryRawUnsafe(`
        SELECT
          COUNT(*)::int AS terminal_total,
          COUNT(*) FILTER (WHERE "orderType" IS NULL)::int AS no_order_type,
          COUNT(*) FILTER (WHERE "package" IS NULL)::int AS no_package,
          COUNT(*) FILTER (WHERE "serviceType" IS NULL)::int AS no_service_type,
          COUNT(*) FILTER (WHERE "lea" IS NULL)::int AS no_lea,
          COUNT(*) FILTER (WHERE "woroTaskName" IS NULL)::int AS no_woro_task,
          COUNT(*) FILTER (WHERE "woroSeit" IS NULL)::int AS no_woro_seit,
          COUNT(*) FILTER (WHERE "orderType" IS NULL AND "package" IS NULL AND "serviceType" IS NULL)::int AS born_fingerprint
        FROM "ServiceOrder"
        WHERE "sltsStatus" IN ('COMPLETED', 'INSTALL_CLOSED')
    `), 'counts');
    console.log('Terminal (COMPLETED/INSTALL_CLOSED) row counts:', JSON.stringify(counts, null, 2));

    const rows = await q(p => p.$queryRawUnsafe(`
        SELECT "soNum", "sltsStatus", "createdAt", "updatedAt", "completedDate"
        FROM "ServiceOrder"
        WHERE "sltsStatus" IN ('COMPLETED', 'INSTALL_CLOSED')
          AND "orderType" IS NULL AND "package" IS NULL AND "serviceType" IS NULL
        ORDER BY "createdAt" DESC
        LIMIT 30
    `), 'rows');
    console.log(`\nBorn-fingerprint rows (all three null), showing ${rows.length}:`);
    for (const r of rows) {
        console.log(`  ${r.soNum} | ${r.sltsStatus} | born ${new Date(r.createdAt).toISOString().slice(0, 16)} | completed ${r.completedDate ? new Date(r.completedDate).toISOString().slice(0, 16) : '-'}`);
    }
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => disconnect());
