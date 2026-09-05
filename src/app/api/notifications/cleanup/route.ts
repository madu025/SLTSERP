export const dynamic = 'force-dynamic';

import { apiHandler } from '@/lib/api-handler';
import { NotificationService } from '@/services/notification/notification.service';
import { NotificationRepository } from '@/repositories/notification.repository';
import { AppError } from '@/lib/error';

/**
 * Notification retention endpoint.
 *
 * This is a manual kick, not a scheduler target. The weekly sweep is queued by the master tick
 * (TICK_DAILY_JOBS -> NOTIFICATION_CLEANUP, Sun 02:00 Asia/Colombo); registering a GET here as
 * well would give the same destructive job a second trigger, and a GET that mutates is something a
 * monitor or a prefetch can fire by accident.
 */
async function assertInternalAuth(req: Request): Promise<void> {
    const authHeader = req.headers.get('authorization');
    const internalSecret = process.env.CRON_SECRET;

    // Fail-closed: refuse to run when CRON_SECRET is not configured
    if (!internalSecret || authHeader !== `Bearer ${internalSecret}`) {
        throw AppError.unauthorized('Unauthorized: Invalid CRON_SECRET');
    }
}

/** What the retention rules would remove right now, without removing it. */
export const GET = apiHandler(async (req) => {
    await assertInternalAuth(req);

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);

    const [read, expired, dedup] = await Promise.all([
        NotificationRepository.count({ createdAt: { lt: cutoff }, isRead: true }),
        NotificationRepository.count({ expiresAt: { lt: cutoff } }),
        NotificationRepository.count({ dedupHash: { not: null } }),
    ]);

    return {
        retentionDays: 30,
        eligible: { readStale: read, expiredPastLifetime: expired, dedupKeyedRows: dedup },
        cutoff: cutoff.toISOString(),
    };
});

/** Run the retention sweep now. */
export const POST = apiHandler(async (req) => {
    await assertInternalAuth(req);

    const result = await NotificationService.cleanup();

    return {
        message: 'Notification cleanup completed successfully',
        deletedCount: result.count,
        detail: { read: result.read, expired: result.expired, supersededDedup: result.superseded },
        timestamp: new Date().toISOString(),
    };
});
