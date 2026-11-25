import { config } from 'dotenv'; config({ path: '.env.local' });
import fs from 'node:fs';
/* eslint-disable @typescript-eslint/no-explicit-any */
// Corrects the unit of OLD contractor issue and return note lines. Until 25 Nov 2026 every line took the unit "Nos" when the caller sent none, so
// drop wire in metres was shown as "Nos". Only lines whose unit is exactly "Nos" while the item's own unit is something else are changed.
// usage: dry | apply      dry: counts and a sample, writes the backup file, changes nothing. apply: one transaction, verified, rolled back on any surprise.
const BACKUP = 'C:/Users/Prasad/AppData/Local/Temp/claude/e397d143faaeb6c1/cf013f60-1b45-4b69-8da2-52e9230f861d/scratchpad/note-units-backup.json';
const TABLES = [
    { table: 'ContractorMaterialIssueItem', label: 'issue note lines' },
    { table: 'ContractorMaterialReturnItem', label: 'return note lines' },
];

async function main() {
    const mode = process.argv[2];
    if (mode !== 'dry' && mode !== 'apply') throw new Error('usage: dry | apply');
    const { prisma } = await import('../src/lib/prisma');
    const where = (t: string) => `FROM public."${t}" n JOIN public."InventoryItem" i ON i.id = n."itemId" WHERE n.unit = 'Nos' AND i.unit IS NOT NULL AND i.unit <> '' AND i.unit <> 'Nos'`;

    const backup: Record<string, any[]> = {};
    for (const { table, label } of TABLES) {
        const rows: any[] = await prisma.$queryRawUnsafe(`SELECT n.id::text AS id, n.unit AS old_unit, i.unit AS new_unit, i.code AS item_code ${where(table)}`);
        backup[table] = rows;
        const byUnit: Record<string, number> = {};
        for (const r of rows) byUnit[r.new_unit] = (byUnit[r.new_unit] ?? 0) + 1;
        const total: any[] = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::int AS c FROM public."${table}"`);
        console.log(`${label}: ${rows.length} of ${total[0].c} lines would change`, JSON.stringify(byUnit), 'sample', JSON.stringify(rows.slice(0, 3).map((r) => `${r.item_code}:${r.old_unit}->${r.new_unit}`)));
    }
    fs.writeFileSync(BACKUP, JSON.stringify({ takenAt: new Date().toISOString(), backup }));
    console.log('backup written to the scratchpad (id, old unit, new unit of every line that will change)');
    if (mode === 'dry') { console.log('dry run: nothing changed'); process.exit(0); }

    await prisma.$transaction(async (tx: any) => {
        const [{ txid }]: any[] = await tx.$queryRawUnsafe('SELECT txid_current()::text AS txid');
        console.log('inside a transaction, txid', txid);
        for (const { table, label } of TABLES) {
            const expected = backup[table].length;
            const n: number = await tx.$executeRawUnsafe(`UPDATE public."${table}" n SET unit = i.unit FROM public."InventoryItem" i WHERE i.id = n."itemId" AND n.unit = 'Nos' AND i.unit IS NOT NULL AND i.unit <> '' AND i.unit <> 'Nos'`);
            if (n !== expected) throw new Error(`${label}: updated ${n}, expected ${expected}: rolling back`);
            const left: any[] = await tx.$queryRawUnsafe(`SELECT COUNT(*)::int AS c ${where(table)}`);
            if (left[0].c !== 0) throw new Error(`${label}: ${left[0].c} lines still wrong: rolling back`);
            console.log(`${label}: ${n} corrected, 0 left (checked inside the transaction)`);
        }
    }, { timeout: 120000 });
    console.log('committed');
    process.exit(0);
}
main().catch((e) => { console.error('FAILED, nothing changed or rolled back:', String(e?.message ?? e).slice(0, 400)); process.exit(1); });
