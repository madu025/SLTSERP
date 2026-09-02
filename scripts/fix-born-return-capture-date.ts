/**
 * Repair (final rule): the Return Date = the ERP CAPTURE moment, not the portal
 * CON_STATUS_DATE (which is the received-date mirror) and not the import moment
 * when a later capture exists.
 *
 * Reverts the previous portal-date re-anchoring: rows whose completedDate equals
 * statusDate - 5h30m are born-RETURN rows (no RETURN history) touched by
 * scripts/fix-born-return-portal-date.ts. For each:
 *   - if a 'SOD Returned (Bridge Sync)' notification exists AFTER the row's
 *     createdAt (a later in-ERP capture, e.g. KX202608310039255 / HC202608260070263
 *     re-returned on 02 Sep ~08:24 UTC = 1:54 pm Colombo) -> completedDate = that
 *     notification time;
 *   - otherwise -> completedDate = createdAt (the import capture moment).
 *
 * Idempotent: re-running finds nothing (values no longer equal statusDate - 5h30m).
 */
import { primaryClient } from '../src/lib/prisma';

const SL_OFFSET_MS = 330 * 60 * 1000; // UTC+05:30 (previous bad offset)

async function main() {
    const rows = await primaryClient.serviceOrder.findMany({
        where: { sltsStatus: 'RETURN', statusDate: { not: null }, completedDate: { not: null } },
        select: { id: true, soNum: true, createdAt: true, completedDate: true, statusDate: true },
    });

    const history = await primaryClient.serviceOrderStatusHistory.findMany({
        where: { serviceOrderId: { in: rows.map((r) => r.id) }, status: 'RETURN' },
        select: { serviceOrderId: true },
    });
    const withHistory = new Set(history.map((h) => h.serviceOrderId));

    const targets = rows.filter((r) => {
        if (withHistory.has(r.id) || !r.statusDate || !r.completedDate) return false;
        const badValue = new Date((r.statusDate as Date).getTime() - SL_OFFSET_MS);
        return r.completedDate.getTime() === badValue.getTime();
    });

    console.log(`Found ${targets.length} born-RETURN rows to re-capture`);
    let fixed = 0;
    for (const r of targets) {
        const capture = await primaryClient.notification.findFirst({
            where: {
                title: 'SOD Returned (Bridge Sync)',
                message: { contains: r.soNum },
                createdAt: { gt: r.createdAt },
            },
            orderBy: { createdAt: 'desc' },
            select: { createdAt: true },
        });
        const completedDate = capture ? capture.createdAt : r.createdAt;
        console.log(
            `  ${r.soNum}: ${r.completedDate.toISOString()} -> ${completedDate.toISOString()}${capture ? ' (bridge-sync capture)' : ' (import moment)'}`
        );
        await primaryClient.serviceOrder.update({ where: { id: r.id }, data: { completedDate } });
        fixed++;
    }
    console.log(`Updated ${fixed} born-RETURN rows`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exitCode = 1;
    })
    .finally(async () => {
        await primaryClient.$disconnect();
    });
