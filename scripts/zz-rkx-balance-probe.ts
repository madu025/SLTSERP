import { config } from 'dotenv'; config({ path: '.env.local' });
/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * READ ONLY. Contractor material balance check for one RTOM (default R-KX):
 * issued (MIN) - SOD used/wasted - accepted returns (MRN) - wastage notes = expected; compared with ContractorStock,
 * ContractorBatchStock and the store side (InventoryStock vs InventoryLedger). Runs inside SET TRANSACTION READ ONLY.
 *
 *   pnpm exec tsx scripts/zz-rkx-balance-probe.ts [RTOM] [day YYYY-MM-DD]
 */
async function main() {
    const rtom = process.argv[2] || 'R-KX';
    const day = process.argv[3] || new Date().toISOString().slice(0, 10);
    const { prisma } = await import('../src/lib/prisma');
    const out: Record<string, unknown> = {};
    await prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
        const q = (sql: string, ...p: unknown[]) => tx.$queryRawUnsafe<any[]>(sql, ...p);

        const opmc = (await q(`SELECT id, rtom, name, "storeId" FROM "OPMC" WHERE rtom = $1`, rtom))[0];
        out.opmc = opmc;
        if (!opmc) return;
        out.store = (await q(`SELECT id, name, type FROM "InventoryStore" WHERE id = $1::uuid`, opmc.storeId))[0];

        // SODs completed on the day (Colombo day) in this OPMC
        out.sodsToday = await q(`
            SELECT so."soNum", so."sltsStatus", so."completedDate", so."contractorId", c.name AS contractor,
                   (SELECT count(*) FROM "SODMaterialUsage" u WHERE u."serviceOrderId" = so.id)::int AS usage_lines,
                   (SELECT max(u."createdAt") FROM "SODMaterialUsage" u WHERE u."serviceOrderId" = so.id) AS usage_last
            FROM "ServiceOrder" so LEFT JOIN "Contractor" c ON c.id = so."contractorId"
            WHERE so."opmcId" = $1::uuid AND so."sltsStatus" IN ('COMPLETED','INSTALL_CLOSED')
              AND (so."completedDate" AT TIME ZONE 'Asia/Colombo')::date = $2::date
            ORDER BY so."completedDate"`, opmc.id, day);

        out.statusCountsToday = await q(`
            SELECT so."sltsStatus", count(*)::int FROM "ServiceOrder" so
            WHERE so."opmcId" = $1::uuid AND (so."completedDate" AT TIME ZONE 'Asia/Colombo')::date >= ($2::date - 2)
            GROUP BY 1`, opmc.id, day);

        // usage rows written since the fresh start (27 Nov) on this OPMC's SODs, by type
        out.usageSinceFreshStart = await q(`
            SELECT u."usageType", count(*)::int, count(u."batchId")::int AS with_batch, sum(u.quantity)::float AS qty, min(u."createdAt") AS first, max(u."createdAt") AS last
            FROM "SODMaterialUsage" u JOIN "ServiceOrder" so ON so.id = u."serviceOrderId"
            WHERE so."opmcId" = $1::uuid AND u."createdAt" >= '2026-11-27' GROUP BY 1`, opmc.id);

        // contractors of this OPMC + any contractor with a SOD today
        const contractors = await q(`
            SELECT DISTINCT c.id, c.name, c.status FROM "Contractor" c
            WHERE c."opmcId" = $1::uuid OR c.id IN (SELECT "contractorId" FROM "ServiceOrder" WHERE "opmcId" = $1::uuid AND "contractorId" IS NOT NULL
                  AND (("completedDate" AT TIME ZONE 'Asia/Colombo')::date = $2::date))`, opmc.id, day).catch(async () =>
            q(`SELECT DISTINCT c.id, c.name, c.status FROM "Contractor" c WHERE c.id IN (SELECT "contractorId" FROM "ServiceOrder" WHERE "opmcId" = $1::uuid AND "contractorId" IS NOT NULL
                  AND (("completedDate" AT TIME ZONE 'Asia/Colombo')::date = $2::date))`, opmc.id, day));
        out.contractorCount = contractors.length;

        const rows: any[] = [];
        for (const c of contractors) {
            const per = await q(`
                WITH iss AS (SELECT ii."itemId", sum(ii.quantity) q FROM "ContractorMaterialIssueItem" ii JOIN "ContractorMaterialIssue" i ON i.id = ii."issueId"
                             WHERE i."contractorId" = $1::uuid AND i.status <> 'REJECTED' GROUP BY 1),
                     ret AS (SELECT ri."itemId", sum(COALESCE(ri."acceptedQuantity", 0)) q FROM "ContractorMaterialReturnItem" ri JOIN "ContractorMaterialReturn" r ON r.id = ri."returnId"
                             WHERE r."contractorId" = $1::uuid AND r.status = 'ACCEPTED' GROUP BY 1),
                     wst AS (SELECT wi."itemId", sum(wi.quantity) q FROM "ContractorWastageItem" wi JOIN "ContractorWastage" w ON w.id = wi."wastageId"
                             WHERE w."contractorId" = $1::uuid AND w.status = 'APPROVED' GROUP BY 1),
                     sod AS (SELECT u."itemId", sum(u.quantity) q FROM "SODMaterialUsage" u JOIN "ServiceOrder" so ON so.id = u."serviceOrderId"
                             WHERE so."contractorId" = $1::uuid AND u."batchId" IS NOT NULL
                               AND u."usageType" IN ('USED','WASTAGE','USED_F1','USED_G1','PORTAL_SYNC') GROUP BY 1),
                     cs AS (SELECT "itemId", quantity q FROM "ContractorStock" WHERE "contractorId" = $1::uuid),
                     cbs AS (SELECT "itemId", sum(quantity) q FROM "ContractorBatchStock" WHERE "contractorId" = $1::uuid GROUP BY 1),
                     ids AS (SELECT "itemId" FROM iss UNION SELECT "itemId" FROM ret UNION SELECT "itemId" FROM wst UNION SELECT "itemId" FROM sod UNION SELECT "itemId" FROM cs UNION SELECT "itemId" FROM cbs)
                SELECT it.code, it.name, it.unit,
                       COALESCE(iss.q,0)::float issued, COALESCE(sod.q,0)::float sod_used, COALESCE(ret.q,0)::float returned, COALESCE(wst.q,0)::float wastage_note,
                       (COALESCE(iss.q,0)-COALESCE(sod.q,0)-COALESCE(ret.q,0)-COALESCE(wst.q,0))::float expected,
                       cs.q::float stock_row, cbs.q::float batch_rows
                FROM ids JOIN "InventoryItem" it ON it.id = ids."itemId"
                LEFT JOIN iss ON iss."itemId" = ids."itemId" LEFT JOIN ret ON ret."itemId" = ids."itemId" LEFT JOIN wst ON wst."itemId" = ids."itemId"
                LEFT JOIN sod ON sod."itemId" = ids."itemId" LEFT JOIN cs ON cs."itemId" = ids."itemId" LEFT JOIN cbs ON cbs."itemId" = ids."itemId"
                ORDER BY it.code`, c.id);
            const sods = await q(`SELECT count(*)::int n FROM "ServiceOrder" WHERE "contractorId" = $1::uuid AND "opmcId" = $2::uuid AND "sltsStatus" IN ('COMPLETED','INSTALL_CLOSED') AND ("completedDate" AT TIME ZONE 'Asia/Colombo')::date = $3::date`, c.id, opmc.id, day);
            const mins = await q(`SELECT "issueNumber", status, "issueDate" FROM "ContractorMaterialIssue" WHERE "contractorId" = $1::uuid ORDER BY "issueDate"`, c.id);
            const mrns = await q(`SELECT "returnNumber", status, "storeId" FROM "ContractorMaterialReturn" WHERE "contractorId" = $1::uuid`, c.id);
            rows.push({ contractor: c.name, status: c.status, sodsToday: sods[0].n, mins, mrns, items: per });
        }
        out.contractors = rows;

        // store side for the OPMC store: InventoryStock vs last ledger quantityAfter vs batch stock
        out.storeSide = await q(`
            SELECT it.code, s.quantity::float stock,
                   (SELECT l."quantityAfter" FROM "InventoryLedger" l WHERE l."storeId" = s."storeId" AND l."itemId" = s."itemId" ORDER BY l."createdAt" DESC, l.id DESC LIMIT 1)::float ledger_after,
                   (SELECT sum(b.quantity) FROM "InventoryBatchStock" b WHERE b."storeId" = s."storeId" AND b."itemId" = s."itemId")::float batch_sum,
                   (SELECT count(*) FROM "InventoryLedger" l WHERE l."storeId" = s."storeId" AND l."itemId" = s."itemId")::int ledger_rows
            FROM "InventoryStock" s JOIN "InventoryItem" it ON it.id = s."itemId" WHERE s."storeId" = $1::uuid ORDER BY it.code`, opmc.storeId);
        out.storeLedgerRows = await q(`SELECT "transactionType", count(*)::int FROM "InventoryLedger" WHERE "storeId" = $1::uuid GROUP BY 1`, opmc.storeId);

        // company-wide context after the fresh start
        out.global = (await q(`SELECT
            (SELECT count(*) FROM "ContractorMaterialIssue")::int AS mins,
            (SELECT count(*) FROM "ContractorMaterialReturn")::int AS mrns,
            (SELECT count(*) FROM "ContractorWastage")::int AS wastage_notes,
            (SELECT count(*) FROM "ContractorStock" WHERE quantity <> 0)::int AS contractor_stock_rows,
            (SELECT count(*) FROM "ContractorBatchStock" WHERE quantity <> 0)::int AS contractor_batch_rows,
            (SELECT count(*) FROM "InventoryStock" WHERE quantity <> 0)::int AS store_stock_rows,
            (SELECT count(*) FROM "InventoryLedger")::int AS ledger_rows,
            (SELECT count(*) FROM "SODMaterialUsage" WHERE "createdAt" >= '2026-11-27')::int AS usage_rows_since_wipe,
            (SELECT count(*) FROM "SODMaterialUsage" WHERE "createdAt" >= '2026-11-27' AND "batchId" IS NOT NULL)::int AS usage_rows_since_wipe_with_batch`))[0];
    }, { maxWait: 10000, timeout: 120000 });
    console.log(JSON.stringify(out, (_k, v) => (typeof v === 'bigint' ? Number(v) : v), 2));
    await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
