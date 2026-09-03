/* READ-ONLY: replicate the strict completed-page bucketing for Jul/Aug/Sep 2026. */
const { q, disconnect } = require('./lib/db-with-retry');

const SONUMS = [
    'AN202607170015584', 'KOT202608140013694', 'KDL202607010034646',
    'KOT202607270025724', 'KDL202607220022318', 'WI202608100070195',
];

async function main() {
    for (const [label, m] of [['Jul', 7], ['Aug', 8], ['Sep', 9]]) {
        const rows = await q(p => p.$queryRawUnsafe(`
            SELECT "soNum", "completedDate"
            FROM "ServiceOrder"
            WHERE ("sltsStatus" = 'COMPLETED'
                   OR "status" IN ('COMPLETED','PAT_OPMC_PASSED','PAT_CORRECTED'))
              AND NOT ("status" = 'PROV_CLOSED'
                   OR "sltsStatus" IN ('PROV_CLOSED','RETURN','DISAPPEARED')
                   OR "status" = 'DISAPPEARED')
              AND "completedDate" >= $1::timestamptz
              AND "completedDate" < $2::timestamptz
            ORDER BY "completedDate"
        `, new Date(2026, m - 1, 1).toISOString(), new Date(2026, m, 1).toISOString()), `month-${label}`);
        const hit = rows.filter(r => SONUMS.includes(r.soNum)).map(r => r.soNum);
        console.log(`${label} 2026: ${rows.length} rows | our 6 rows here: ${hit.join(', ') || '-'}`);
    }
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => disconnect());
