/**
 * Repair: born-RETURN rows — return date = the portal's own CON_STATUS_DATE.
 *
 * CON_STATUS_DATE strings are Sri Lanka local time but parseStatusDate parses
 * them on a UTC server, so stored statusDate values are Colombo wall-clock
 * labelled UTC. Subtracting the 5h30m offset recovers the real instant
 * (TAN202608220091216 proved the clock: its portal STATUS DATE 11:57 was stored
 * "ahead" of the push that imported it — only possible with SL local time).
 *
 * Rule (idempotent): sltsStatus = RETURN, no RETURN history row (the row never
 * transitioned inside the ERP — it was born RETURN), completedDate null or
 * equal to createdAt (import moment), and statusDate present
 * -> completedDate = statusDate - 5h30m.
 *
 * Rows WITH a RETURN history keep their true ERP transition instants, and
 * old-portal-date rows (DX/VR/NT/DOL/BD 2024-2025) move back to their real
 * return months, matching the portal dates shown on the return page.
 */
import { primaryClient } from '../src/lib/prisma';

const SL_OFFSET_MS = 330 * 60 * 1000; // UTC+05:30

async function main() {
    const rows = await primaryClient.serviceOrder.findMany({
        where: { sltsStatus: 'RETURN', statusDate: { not: null } },
        select: { id: true, soNum: true, createdAt: true, completedDate: true, statusDate: true },
    });

    const history = await primaryClient.serviceOrderStatusHistory.findMany({
        where: { serviceOrderId: { in: rows.map((r) => r.id) }, status: 'RETURN' },
        select: { serviceOrderId: true },
    });
    const withHistory = new Set(history.map((h) => h.serviceOrderId));

    const targets = rows.filter(
        (r) =>
            !withHistory.has(r.id) &&
            r.statusDate &&
            (!r.completedDate || r.completedDate.getTime() === r.createdAt.getTime())
    );

    console.log(`Found ${targets.length} born-RETURN rows to re-anchor`);
    let fixed = 0;
    const CHUNK = 50;
    for (let i = 0; i < targets.length; i += CHUNK) {
        await primaryClient.$transaction(
            targets.slice(i, i + CHUNK).map((r) => {
                const trueInstant = new Date((r.statusDate as Date).getTime() - SL_OFFSET_MS);
                console.log(`  ${r.soNum}: ${r.completedDate ? r.completedDate.toISOString() : 'null'} -> ${trueInstant.toISOString()}`);
                return primaryClient.serviceOrder.update({
                    where: { id: r.id },
                    data: { completedDate: trueInstant },
                });
            })
        );
        fixed += Math.min(CHUNK, targets.length - i);
    }
    console.log(`Re-anchored ${fixed} born-RETURN rows`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exitCode = 1;
    })
    .finally(async () => {
        await primaryClient.$disconnect();
    });
