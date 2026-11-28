import { config } from 'dotenv'; config({ path: '.env.local' });
/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * READ ONLY. Map every row that hangs off the ZZ test stores (name starts with "ZZ"), following foreign keys from the
 * stores downwards (children of children), plus the test masters made for them (items, vendors, users with a ZZ prefix)
 * and what still points at those masters from outside. Prints counts per table; writes the id lists to the given file.
 *
 *   pnpm exec tsx scripts/zz-test-store-map.ts <out.json>
 */
async function main() {
    const { prisma } = await import('../src/lib/prisma');
    const out: any = { tables: {}, outside: {}, triggers: [] };
    await prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
        const q = (s: string, ...p: unknown[]) => tx.$queryRawUnsafe<any[]>(s, ...p);
        // all single-column FKs in public
        const fks: Array<{ child: string; col: string; parent: string; pcol: string; del: string }> = await q(`
            SELECT c.relname child, a.attname col, p.relname parent, pa.attname pcol, con.confdeltype del
            FROM pg_constraint con JOIN pg_class c ON c.oid = con.conrelid JOIN pg_class p ON p.oid = con.confrelid
            JOIN pg_attribute a ON a.attrelid = con.conrelid AND a.attnum = con.conkey[1]
            JOIN pg_attribute pa ON pa.attrelid = con.confrelid AND pa.attnum = con.confkey[1]
            JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE con.contype = 'f' AND n.nspname = 'public' AND array_length(con.conkey, 1) = 1`);
        const withId = new Set((await q(`SELECT table_name t FROM information_schema.columns WHERE table_schema = 'public' AND column_name = 'id'`)).map((r) => r.t));
        const noId = [...new Set(fks.filter((f) => !withId.has(f.child)).map((f) => f.child))];
        out.childTablesWithoutId = noId;
        fks.splice(0, fks.length, ...fks.filter((f) => withId.has(f.child)));
        out.triggers = await q(`SELECT event_object_table t, trigger_name n, action_timing || ' ' || event_manipulation ev FROM information_schema.triggers WHERE trigger_schema = 'public' ORDER BY 1`);

        const ids = new Map<string, Set<string>>(); // table -> ids
        const add = (t: string, list: string[]) => { const s = ids.get(t) ?? new Set(); const before = s.size; list.forEach((x) => s.add(x)); ids.set(t, s); return s.size - before; };
        const stores = await q(`SELECT id::text FROM "InventoryStore" WHERE name LIKE 'ZZ%' OR location = 'ZZTEST'`);
        add('InventoryStore', stores.map((r) => r.id));
        const items = await q(`SELECT id::text FROM "InventoryItem" WHERE code LIKE 'ZZ%' OR name LIKE 'ZZ%'`);
        add('InventoryItem', items.map((r) => r.id));
        const vendors = await q(`SELECT id::text FROM "Vendor" WHERE code LIKE 'ZZ%' OR name LIKE 'ZZ%'`);
        add('Vendor', vendors.map((r) => r.id));
        const users = await q(`SELECT id::text FROM "User" WHERE username ILIKE 'zz%'`);
        add('User', users.map((r) => r.id));
        const sods = await q(`SELECT id::text FROM "ServiceOrder" WHERE "soNum" LIKE 'ZZ%'`);
        add('ServiceOrder', sods.map((r) => r.id));
        const contractors = await q(`SELECT id::text FROM "Contractor" WHERE name LIKE 'ZZ%'`);
        add('Contractor', contractors.map((r) => r.id));
        out.seeds = { sods: sods.length, contractors: contractors.length, stores: stores.length, items: items.length, vendors: vendors.length, users: users.length };

        // walk children: any row whose FK points to a collected row is collected (but never walk INTO masters we did not seed)
        const NO_WALK_INTO = new Set(['InventoryItem', 'Vendor', 'User', 'OPMC', 'Contractor', 'InventoryStore', 'ServiceOrder']);
        for (let round = 0; round < 12; round++) {
            let grew = 0;
            for (const fk of fks) {
                const parentIds = ids.get(fk.parent);
                if (!parentIds || parentIds.size === 0) continue;
                if (fk.pcol !== 'id') continue;
                if (NO_WALK_INTO.has(fk.child)) continue;
                const rows = await q(`SELECT id::text FROM "${fk.child}" WHERE "${fk.col}"::text = ANY($1::text[])`, [...parentIds]);
                if (rows.length) grew += add(fk.child, rows.map((r) => r.id));
            }
            if (!grew) break;
        }
        // links that are not foreign keys (referenceId, supplierInvoiceId without a constraint, ...): scan every uuid column and every
        // text column whose name ends in Id, in tables that have an id; repeat until nothing new is found
        const cols: Array<{ t: string; c: string; dt: string }> = await q(`SELECT table_name t, column_name c, data_type dt FROM information_schema.columns
            WHERE table_schema = 'public' AND column_name <> 'id' AND (data_type = 'uuid' OR (data_type IN ('text','character varying') AND column_name ~ 'Id$'))`);
        const fkSet = new Set(fks.map((f) => `${f.child}.${f.col}`));
        const scan = cols.filter(({ t, c }) => withId.has(t) && !fkSet.has(`${t}.${c}`) && !NO_WALK_INTO.has(t));
        out.implicit = {};
        const fkScan = () => fks.filter((f) => f.pcol === 'id' && !NO_WALK_INTO.has(f.child) && (ids.get(f.parent)?.size ?? 0) > 0);
        for (let round = 0; round < 8; round++) {
            const all = [...new Set([...ids.values()].flatMap((x) => [...x]))];
            const parts = [
                ...scan.map(({ t, c, dt }) => `SELECT '${t}' t, '${t}.${c}' via, id::text FROM "${t}" WHERE "${c}" = ANY(${dt === 'uuid' ? '$1::uuid[]' : '$2::text[]'})`),
                ...fkScan().map((f) => `SELECT '${f.child}' t, '${f.child}.${f.col}' via, id::text FROM "${f.child}" WHERE "${f.col}"::text = ANY($2::text[])`),
            ];
            const rows: Array<{ t: string; via: string; id: string }> = await q(parts.join(' UNION ALL '), all, all);
            let grew = 0;
            for (const r of rows) {
                const g = add(r.t, [r.id]);
                if (g) { grew += g; if (!fkSet.has(r.via)) out.implicit[r.via] = (out.implicit[r.via] ?? 0) + 1; }
            }
            if (!grew) break;
        }
        for (const [t, s] of ids) out.tables[t] = s.size;

        // rows OUTSIDE the set that point at a collected row (they would block or lose a reference)
        for (const fk of fks) {
            const parentIds = ids.get(fk.parent);
            if (!parentIds || parentIds.size === 0 || fk.pcol !== 'id') continue;
            const mine = ids.get(fk.child) ?? new Set<string>();
            const rows = await q(`SELECT id::text FROM "${fk.child}" WHERE "${fk.col}"::text = ANY($1::text[])`, [...parentIds]);
            const foreign = rows.filter((r) => !mine.has(r.id));
            if (foreign.length) out.outside[`${fk.child}.${fk.col} -> ${fk.parent} (on delete ${fk.del})`] = foreign.length;
        }
        out.ids = Object.fromEntries([...ids].map(([t, s]) => [t, [...s]]));
        out.opmcLinked = await q(`SELECT rtom FROM "OPMC" WHERE "storeId"::text = ANY($1::text[])`, [...(ids.get('InventoryStore') ?? [])]);
        out.storeNames = await q(`SELECT name FROM "InventoryStore" WHERE id::text = ANY($1::text[]) ORDER BY name`, [...(ids.get('InventoryStore') ?? [])]);
        out.itemNames = await q(`SELECT code FROM "InventoryItem" WHERE id::text = ANY($1::text[]) ORDER BY code`, [...(ids.get('InventoryItem') ?? [])]);
    }, { maxWait: 10000, timeout: 900000 });
    const fs = await import('node:fs');
    fs.writeFileSync(process.argv[2], JSON.stringify(out, null, 1));
    const { ids: _i, ...summary } = out;
    console.log(JSON.stringify({ ...summary, triggers: out.triggers.length }, null, 1));
    await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
