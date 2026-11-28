import { config } from 'dotenv'; config({ path: '.env.local' });
/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Owner, 28 Nov 2026: delete the 9 ContractorStock rows of R.M.S.D.Ekanayaka (R-BW) that the HO PAT rejection of
 * BW202605210081088 created on 27 Nov 10:30 without any issue note (no batch rows, no MIN). One transaction, guarded:
 * exactly these 9 rows, no batch stock, no MIN/MRN/wastage for the contractor. Dry run by default; `--commit` to keep.
 */
class DryRun extends Error {}
const EXPECTED: Record<string, number> = {
    'OSP-HC-CBL-DW': 342, 'OSP-NC-ACC-DWRETNER': 16, 'OSP-NC-MM-CHOOK': 1, OSPFTA007: 1, 'OSP-HC-ACC-FAC': 2,
    'HDB-HDW-CTIE-4': 19, 'HDB-HDW-CNAIL-1': 6, 'HDB-FLEX-CON-1/4-W': 1, 'HDB-TRUNK-16x12.5': 2,
};
async function main() {
    const commit = process.argv[2] === '--commit';
    const { prisma } = await import('../src/lib/prisma');
    const report: any = { mode: commit ? 'COMMIT' : 'DRY RUN' };
    try {
        await prisma.$transaction(async (tx) => {
            const q = (s: string, ...p: unknown[]) => tx.$queryRawUnsafe<any[]>(s, ...p);
            report.txid = (await q(`SELECT txid_current()::text t`))[0].t;
            const c = await q(`SELECT id FROM "Contractor" WHERE name = 'R.M.S.D.Ekanayaka'`);
            if (c.length !== 1) throw new Error(`GUARD: ${c.length} contractors with that name`);
            const C = c[0].id;
            const rows = await q(`SELECT cs.id, it.code, cs.quantity::float q, cs."updatedAt" FROM "ContractorStock" cs JOIN "InventoryItem" it ON it.id = cs."itemId" WHERE cs."contractorId" = $1::uuid FOR UPDATE OF cs`, C);
            report.backup = rows;
            const ok = rows.length === 9 && rows.every((r) => EXPECTED[r.code] === r.q);
            if (!ok) throw new Error(`GUARD: rows differ from the expected 9: ${JSON.stringify(rows.map((r) => [r.code, r.q]))}`);
            const docs = (await q(`SELECT
                (SELECT count(*) FROM "ContractorBatchStock" WHERE "contractorId" = $1::uuid)::int batches,
                (SELECT count(*) FROM "ContractorMaterialIssue" WHERE "contractorId" = $1::uuid)::int mins,
                (SELECT count(*) FROM "ContractorMaterialReturn" WHERE "contractorId" = $1::uuid)::int mrns,
                (SELECT count(*) FROM "ContractorWastage" WHERE "contractorId" = $1::uuid)::int wastage`, C))[0];
            if (docs.batches || docs.mins || docs.mrns || docs.wastage) throw new Error(`GUARD: the contractor has documents ${JSON.stringify(docs)}`);
            report.deleted = await tx.$executeRawUnsafe(`DELETE FROM "ContractorStock" WHERE id::text = ANY($1::text[])`, rows.map((r) => r.id));
            report.left = (await q(`SELECT count(*)::int n FROM "ContractorStock" WHERE "contractorId" = $1::uuid`, C))[0].n;
            if (report.deleted !== 9 || report.left !== 0) throw new Error('CHECK failed');
            if (!commit) throw new DryRun();
        }, { maxWait: 15000, timeout: 60000 });
        report.result = 'COMMITTED';
    } catch (e: any) {
        report.result = e instanceof DryRun ? 'ROLLED BACK (dry run)' : 'ERROR ' + String(e.message).slice(0, 300);
    }
    report.outside = (await prisma.$queryRawUnsafe<any[]>(`SELECT count(*)::int n FROM "ContractorStock" cs JOIN "Contractor" c ON c.id = cs."contractorId" WHERE c.name = 'R.M.S.D.Ekanayaka'`))[0].n;
    console.log(JSON.stringify(report));
    await prisma.$disconnect();
}
main();
