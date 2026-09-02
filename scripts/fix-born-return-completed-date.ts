/**
 * Repair: born-RETURN rows got a drifted completedDate from the backfill fallback.
 *
 * Rows bulk-imported directly AS RETURN (createdAt shared by several RETURN rows,
 * no RETURN status history — creates never write history) have their "ERP learned
 * the return" moment at createdAt. If a later re-scrape touched the row
 * (updatedAt > createdAt), the backfill's updatedAt fallback recorded that touch
 * instead — e.g. HC202608280092727 showed 02/09 07:22 UTC although the ERP created
 * it as RETURN on 08/31 18:01 UTC.
 *
 * Rule (idempotent): sltsStatus = RETURN, no RETURN history row, createdAt shared
 * by >= 2 history-less RETURN rows (batch-import signature), and completedDate
 * null or later than createdAt  ->  completedDate = createdAt.
 */
import { primaryClient } from '../src/lib/prisma';

async function main() {
    const rows = await primaryClient.serviceOrder.findMany({
        where: { sltsStatus: 'RETURN' },
        select: { id: true, soNum: true, createdAt: true, completedDate: true },
    });

    const returnIds = new Set(rows.map((r) => r.id));
    const history = await primaryClient.serviceOrderStatusHistory.findMany({
        where: { serviceOrderId: { in: [...returnIds] }, status: 'RETURN' },
        select: { serviceOrderId: true },
    });
    const withHistory = new Set(history.map((h) => h.serviceOrderId));

    // Batch-import signature: identical createdAt shared by >= 2 history-less RETURN rows
    const batchCounts = new Map<number, number>();
    for (const r of rows) {
        if (withHistory.has(r.id)) continue;
        batchCounts.set(r.createdAt.getTime(), (batchCounts.get(r.createdAt.getTime()) || 0) + 1);
    }

    let fixed = 0;
    for (const r of rows) {
        if (withHistory.has(r.id)) continue;
        if ((batchCounts.get(r.createdAt.getTime()) || 0) < 2) continue;
        if (r.completedDate && r.completedDate <= r.createdAt) continue;

        await primaryClient.serviceOrder.update({
            where: { id: r.id },
            data: { completedDate: r.createdAt },
        });
        fixed++;
        console.log(`Fixed ${r.soNum}: completedDate -> ${r.createdAt.toISOString()} (batch-born RETURN)`);
    }

    console.log(`Repaired ${fixed} born-RETURN SODs.`);
    await primaryClient.$disconnect();
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
