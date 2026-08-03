/**
 * One-off backfill: welcome notification + USER_CREATE audit entry for users
 * imported by scripts/import-o365-users.ts (whose original audit writes
 * failed due to the AuditLog uuid column bug, fixed 2026-08-03).
 *
 * Usage: npx tsx scripts/backfill-welcome-notifications.ts
 */
import { prisma } from '../src/lib/prisma';
import { SystemService } from '../src/services/core/system.service';

async function main() {
    const cutoff = new Date('2026-08-03T00:00:00Z');

    const users = await prisma.user.findMany({
        where: {
            role: 'ENGINEER',
            mustChangePassword: true,
            createdAt: { gte: cutoff }
        },
        select: { id: true, username: true, name: true, role: true }
    });

    console.log(`[BACKFILL] Users to notify: ${users.length}`);

    let ok = 0;
    let failed = 0;

    for (const user of users) {
        try {
            await SystemService.logEvent({
                userId: user.id,
                action: 'USER_CREATE',
                entity: 'User',
                entityId: user.id,
                newValue: { id: user.id, username: user.username, name: user.name, role: user.role },
                notify: true,
                notifyTitle: 'Welcome to SLT ERP',
                notifyMessage: `An administrator has created your account as ${user.role}. Please setup your security profile.`,
                notifyType: 'SYSTEM'
            });
            ok++;
        } catch (err) {
            failed++;
            console.error(`[FAIL] ${user.username}:`, err instanceof Error ? err.message : err);
        }
    }

    console.log(`[BACKFILL] Done. ok=${ok} failed=${failed}`);
}

main()
    .catch((err) => {
        console.error('[BACKFILL] Fatal error:', err);
        process.exitCode = 1;
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
