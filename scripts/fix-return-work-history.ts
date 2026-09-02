/**
 * Repair: RETURN SOD detail-modal hygiene.
 *
 * 1. Work History — creates never wrote status history, so born-RETURN rows show
 *    "No status history recorded yet". Seed a RETURN history entry for every
 *    RETURN row with zero history rows (statusDate = completedDate || createdAt,
 *    matching the ERP-capture-time attribution rule).
 * 2. Standard Details — legacy workflow `status` stayed PENDING/INPROGRESS on
 *    returned SODs, making the modal show an active-looking status. Align
 *    `status` to 'RETURN' (mirrors the INSTALL_CLOSED self-heal in syncAllOpmcs).
 *
 * Idempotent: history is only written when the row has zero history entries;
 * status heal only targets stale workflow statuses.
 */
import { primaryClient } from '../src/lib/prisma';

async function main() {
    const rows = await primaryClient.serviceOrder.findMany({
        where: { sltsStatus: 'RETURN' },
        select: { id: true, soNum: true, createdAt: true, completedDate: true, status: true },
    });

    // ── 1. Seed RETURN history for rows with zero status history ──
    const withAnyHistory = new Set(
        (
            await primaryClient.serviceOrderStatusHistory.findMany({
                where: { serviceOrderId: { in: rows.map((r) => r.id) } },
                select: { serviceOrderId: true },
            })
        ).map((h) => h.serviceOrderId),
    );

    const historyTargets = rows.filter((r) => !withAnyHistory.has(r.id));
    console.log(`RETURN rows without any history: ${historyTargets.length}`);
    if (historyTargets.length > 0) {
        const res = await primaryClient.serviceOrderStatusHistory.createMany({
            data: historyTargets.map((r) => ({
                serviceOrderId: r.id,
                status: 'RETURN' as const,
                statusDate: r.completedDate ?? r.createdAt,
            })),
        });
        console.log(`Seeded ${res.count} RETURN history entries`);
        for (const r of historyTargets) {
            const at = (r.completedDate ?? r.createdAt).toISOString();
            console.log(`  ${r.soNum}: RETURN @ ${at}`);
        }
    }

    // ── 2. Heal stale workflow status on RETURN rows ──
    const staleStatuses = new Set(['PENDING', 'INPROGRESS', 'ASSIGNED', 'PROV_CLOSED']);
    const statusTargets = rows.filter((r) => staleStatuses.has(r.status));
    console.log(`RETURN rows with stale workflow status: ${statusTargets.length}`);
    for (const r of statusTargets) {
        await primaryClient.serviceOrder.update({ where: { id: r.id }, data: { status: 'RETURN' } });
        console.log(`  ${r.soNum}: status ${r.status} -> RETURN`);
    }
    console.log(`Healed ${statusTargets.length} stale workflow statuses`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exitCode = 1;
    })
    .finally(async () => {
        await primaryClient.$disconnect();
    });
