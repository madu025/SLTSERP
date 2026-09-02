/**
 * Backfill: RETURN SODs never got completedDate (bridge sync only set it for
 * COMPLETED/INSTALL_CLOSED), so the Return Date column and the return-list month
 * buckets fell back to the portal's CON_STATUS_DATE — which can lag the actual
 * return notification by days (e.g. KX202608240015607: portal Aug 31, sync Sep 2).
 *
 * Rule: completedDate = first 'RETURN' ServiceOrderStatusHistory row createdAt
 * (the transition moment in the ERP), falling back to updatedAt for rows with no
 * history (bulk-import rows where updatedAt == createdAt, and legacy sync rows).
 *
 * Idempotent: only touches sltsStatus = 'RETURN' AND completedDate IS NULL.
 */
import { primaryClient } from '../src/lib/prisma';

async function main() {
    const rows = await primaryClient.serviceOrder.findMany({
        where: { sltsStatus: 'RETURN', completedDate: null },
        select: { id: true, soNum: true, updatedAt: true },
    });

    if (rows.length === 0) {
        console.log('Nothing to backfill: no RETURN SODs with null completedDate.');
        await primaryClient.$disconnect();
        return;
    }

    const ids = rows.map((r) => r.id);
    const history = await primaryClient.serviceOrderStatusHistory.findMany({
        where: { serviceOrderId: { in: ids }, status: 'RETURN' },
        orderBy: { createdAt: 'asc' },
        select: { serviceOrderId: true, createdAt: true },
    });

    const firstReturnAt = new Map<string, Date>();
    for (const h of history) {
        if (!firstReturnAt.has(h.serviceOrderId)) {
            firstReturnAt.set(h.serviceOrderId, h.createdAt);
        }
    }

    let fromHistory = 0;
    let fromUpdatedAt = 0;
    const CHUNK = 50;
    for (let i = 0; i < rows.length; i += CHUNK) {
        await Promise.all(rows.slice(i, i + CHUNK).map(async (row) => {
            const histDate = firstReturnAt.get(row.id);
            const completedDate = histDate ?? row.updatedAt;
            if (histDate) {
                fromHistory++;
            } else {
                fromUpdatedAt++;
            }
            await primaryClient.serviceOrder.update({
                where: { id: row.id },
                data: { completedDate },
            });
        }));
    }

    console.log(`Backfilled ${rows.length} RETURN SODs: ${fromHistory} from status history, ${fromUpdatedAt} from updatedAt.`);
    await primaryClient.$disconnect();
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
