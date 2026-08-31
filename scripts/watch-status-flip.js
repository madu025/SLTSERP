const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

const TARGETS = [
    'MV202608260070402',
    'AN202608280090090',
    'SIY202608250037283',
    'TG202607200062009'
];

async function snapshot() {
    return await p.$queryRawUnsafe(`
        SELECT "soNum", status::text, "sltsStatus"::text, "updatedAt", xmin::text AS xmin
        FROM "ServiceOrder" WHERE "soNum" = ANY($1::text[])
    `, TARGETS);
}

async function activity() {
    return await p.$queryRawUnsafe(`
        SELECT pid, state::text, LEFT(query, 300) AS query, now() - query_start AS running_for
        FROM pg_stat_activity
        WHERE state = 'active' AND query ILIKE '%ServiceOrder%' AND pid <> pg_backend_pid()
    `);
}

async function main() {
    const durationMs = 6 * 60 * 1000;
    const intervalMs = 5000;
    const start = Date.now();
    let prev = new Map();

    console.log(`[WATCH] started ${new Date().toISOString()} watching ${TARGETS.length} rows`);
    while (Date.now() - start < durationMs) {
        try {
            const rows = await snapshot();
            for (const r of rows) {
                const key = r.soNum;
                const sig = `${r.status}|${r.xmin}`;
                const before = prev.get(key);
                if (before && before !== sig) {
                    console.log(`\n[FLIP ${new Date().toISOString()}] ${key}: ${before} -> ${sig}`);
                    console.log(`  row: ${JSON.stringify(r)}`);
                    const acts = await activity();
                    console.log(`  active queries on ServiceOrder:`);
                    acts.forEach(a => console.log(`   pid=${a.pid} for=${a.running_for} ${a.query}`));
                    if (acts.length === 0) console.log('   (none captured)');
                }
                prev.set(key, sig);
            }
        } catch (e) {
            console.error('poll error:', e.message?.slice(0, 100));
        }
        await new Promise(r => setTimeout(r, intervalMs));
    }
    console.log(`[WATCH] ended ${new Date().toISOString()}`);
    const final = await snapshot();
    final.forEach(r => console.log(`FINAL ${r.soNum}: ${r.status} | updatedAt=${r.updatedAt} | xmin=${r.xmin}`));
}

main().catch(console.error).finally(() => p.$disconnect());
