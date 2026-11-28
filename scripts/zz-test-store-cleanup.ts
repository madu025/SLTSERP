import { config } from 'dotenv'; config({ path: '.env.local' });
/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Delete the ZZ test stores and everything made with them (owner, 28 Nov 2026), from the id map written by
 * scripts/zz-test-store-map.ts. ONE transaction. DRY RUN by default (rolled back); `--commit` to keep it.
 *
 *   pnpm exec tsx scripts/zz-test-store-map.ts map.json
 *   pnpm exec tsx scripts/zz-test-store-cleanup.ts map.json            # dry run
 *   pnpm exec tsx scripts/zz-test-store-cleanup.ts map.json --commit   # after a server pg_dump
 *
 * Steps: re-check every id still exists (guard) -> unlink OPMCs from the test stores -> switch off the three
 * "no delete" triggers (ledger, audit log, PO approvals) inside this transaction only -> delete user-OPMC links ->
 * delete the rows, retrying in rounds until foreign keys allow every table -> check nothing is left -> triggers on again.
 */
class DryRun extends Error {}
const IMMUTABLE = [['InventoryLedger', 'trg_inventory_ledger_immutable'], ['AuditLog', 'trg_audit_log_immutable'], ['PurchaseOrderApproval', 'trg_po_approval_immutable']];

async function main() {
    const [mapFile, flag] = process.argv.slice(2);
    const commit = flag === '--commit';
    const fs = await import('node:fs');
    const map = JSON.parse(fs.readFileSync(mapFile, 'utf8'));
    const ids: Record<string, string[]> = Object.fromEntries(Object.entries(map.ids as Record<string, string[]>).filter(([, v]) => v.length));
    const { prisma } = await import('../src/lib/prisma');
    const report: any = { mode: commit ? 'COMMIT' : 'DRY RUN', deleted: {}, rounds: 0 };
    try {
        await prisma.$transaction(async (tx) => {
            const q = (s: string, ...p: unknown[]) => tx.$queryRawUnsafe<any[]>(s, ...p);
            const x = (s: string, ...p: unknown[]) => tx.$executeRawUnsafe(s, ...p);
            const txid = (await q(`SELECT txid_current()::text t, now() = statement_timestamp() AS same_stmt`))[0];
            report.transaction = `txid ${txid.t} (one transaction: now() is fixed, statement time moves)`;

            // guard: every id of the map still exists and the stores are still the test stores
            for (const [t, list] of Object.entries(ids)) {
                const n = (await q(`SELECT count(*)::int n FROM "${t}" WHERE id::text = ANY($1::text[])`, list))[0].n;
                if (n !== list.length) throw new Error(`GUARD: ${t} has ${n} of ${list.length} mapped rows: re-run the map first`);
            }
            const bad = await q(`SELECT name FROM "InventoryStore" WHERE id::text = ANY($1::text[]) AND NOT (name LIKE 'ZZ%' OR location = 'ZZTEST')`, ids.InventoryStore);
            if (bad.length) throw new Error(`GUARD: not a test store: ${bad.map((b) => b.name).join(', ')}`);
            const badUsers = await q(`SELECT username FROM "User" WHERE id::text = ANY($1::text[]) AND username NOT ILIKE 'zz%'`, ids.User ?? []);
            if (badUsers.length) throw new Error(`GUARD: not a test user: ${badUsers.map((b) => b.username).join(', ')}`);

            report.opmcUnlinked = (await q(`UPDATE "OPMC" SET "storeId" = NULL WHERE "storeId"::text = ANY($1::text[]) RETURNING rtom`, ids.InventoryStore)).map((r) => r.rtom);
            for (const [t, trg] of IMMUTABLE) await x(`ALTER TABLE "${t}" DISABLE TRIGGER ${trg}`);
            if (ids.User) report.deleted._UserOpmcs = await x(`DELETE FROM "_UserOpmcs" WHERE "B"::text = ANY($1::text[]) OR "A"::text = ANY($1::text[])`, ids.User);

            // delete in rounds: a table whose rows are still referenced fails inside a savepoint and is tried again next round
            let left = Object.keys(ids);
            for (let round = 1; left.length && round <= 40; round++) {
                report.rounds = round;
                const next: string[] = [];
                for (const t of left) {
                    await x(`SAVEPOINT d`);
                    try {
                        const n = await x(`DELETE FROM "${t}" WHERE id::text = ANY($1::text[])`, ids[t]);
                        await x(`RELEASE SAVEPOINT d`);
                        report.deleted[t] = (report.deleted[t] ?? 0) + n;
                    } catch (e: any) {
                        await x(`ROLLBACK TO SAVEPOINT d`);
                        next.push(t);
                        report.lastError = `${t}: ${String(e.message).split('Message:')[1]?.slice(0, 160) ?? String(e.message).slice(0, 160)}`;
                    }
                }
                if (next.length === left.length) throw new Error(`STUCK: ${next.join(', ')} (${report.lastError})`);
                left = next;
            }
            for (const [t, trg] of IMMUTABLE) await x(`ALTER TABLE "${t}" ENABLE TRIGGER ${trg}`);

            // checks before commit
            const remain: Record<string, number> = {};
            for (const [t, list] of Object.entries(ids)) { const n = (await q(`SELECT count(*)::int n FROM "${t}" WHERE id::text = ANY($1::text[])`, list))[0].n; if (n) remain[t] = n; }
            if (Object.keys(remain).length) throw new Error(`CHECK: rows left ${JSON.stringify(remain)}`);
            report.after = (await q(`SELECT
                (SELECT count(*) FROM "InventoryStore" WHERE name LIKE 'ZZ%' OR location = 'ZZTEST')::int zz_stores,
                (SELECT count(*) FROM "InventoryLedger")::int ledger_rows,
                (SELECT count(*) FROM "JournalEntry")::int journals,
                (SELECT count(*) FROM "User" WHERE username ILIKE 'zz%')::int zz_users,
                (SELECT count(*) FROM "ServiceOrder" WHERE "soNum" LIKE 'ZZ%')::int zz_sods,
                (SELECT "storeId" FROM "OPMC" WHERE rtom = 'R-KX') rkx_store,
                (SELECT count(*) FROM pg_trigger WHERE tgname IN ('trg_inventory_ledger_immutable','trg_audit_log_immutable','trg_po_approval_immutable') AND tgenabled = 'O')::int triggers_on`))[0];
            if (report.after.triggers_on !== 3) throw new Error('CHECK: immutability triggers not back on');
            if (!commit) throw new DryRun('dry run');
        }, { maxWait: 15000, timeout: 600000 });
    } catch (e: any) {
        if (!(e instanceof DryRun)) { report.error = String(e.message).slice(0, 400); }
        else report.result = 'ROLLED BACK (dry run): nothing changed';
    }
    if (commit && !report.error) report.result = 'COMMITTED';
    // proof from outside the transaction
    report.outside = (await prisma.$queryRawUnsafe<any[]>(`SELECT (SELECT count(*) FROM "InventoryStore" WHERE name LIKE 'ZZ%' OR location = 'ZZTEST')::int zz_stores, (SELECT count(*) FROM "JournalEntry")::int journals`))[0];
    console.log(JSON.stringify(report, null, 1));
    await prisma.$disconnect();
    process.exit(report.error ? 1 : 0);
}
main();
