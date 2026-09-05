import { eventBus } from './event-bus';
import { SOD_STATUS_RANK, isStorableSltsStatus } from '@/lib/constants/sod-status-policy';

/** Lifecycle position, or undefined for anything outside the storable set. */
function rankOfStatus(status: string | null | undefined): number | undefined {
    if (!isStorableSltsStatus(status)) return undefined;
    return SOD_STATUS_RANK[status as keyof typeof SOD_STATUS_RANK];
}

export function registerSODEventHandlers() {
    eventBus.subscribe('sod.status_changed', async (payload) => {
        const {
            serviceOrderId,
            soNum,
            opmcId,
            oldStatus,
            newStatus,
            returnReason,
            userId,
            actor
        } = payload;

        // One transition reading, shared by every consumer below. The writer only publishes when
        // `sltsStatus` really moved, so this is about direction rather than duplication: a rank
        // increase is progress, anything else is a feed restating what it already reported.
        const isRankIncrease = (rankOfStatus(newStatus) ?? -1) > (rankOfStatus(oldStatus) ?? -1);

        try {
            // 1. Stats Recalculation
            const { StatsService } = await import('../stats.service');
            await StatsService.handleStatusChange(opmcId, oldStatus || 'PENDING', newStatus);
        } catch (err) {
            console.error('[EVENT-HANDLER-ERROR] Failed to handle status change stats update:', err);
        }

        // 2. COMPLETED → Notify managers/engineers
        // Only a forward move into COMPLETED is a business event (defect O2: 1,910 completion rows
        // for 91 SODs). A lateral or backward write - the completion feed replaying a row the
        // installer already closed, INSTALL_CLOSED restated as COMPLETED - announces nothing.
        // System auto-completion stays silent because the batch summary covers it.
        if (newStatus === 'COMPLETED' && isRankIncrease && actor !== 'AUTO_COMPLETE' && userId !== 'SYSTEM_AUTO_COMPLETE') {
            try {
                const { prisma } = await import('../prisma');
                const order = await prisma.serviceOrder.findUnique({
                    where: { id: serviceOrderId },
                    select: { soNum: true, customerName: true, opmcId: true, completedDate: true, materialUsage: true, collectedCPEs: { select: { id: true } } }
                });
                if (order) {
                    const { DomainNotificationPolicies } = await import('../../services/notification/domain-policies.service');
                    await DomainNotificationPolicies.notifySODCompleted({
                        soNum: order.soNum,
                        customerName: order.customerName || undefined,
                        completedByUserId: userId,
                        opmcId: order.opmcId || undefined,
                        // Dedup day is the business completion day, not the delivery time.
                        completedDate: order.completedDate,
                        materialsCount: Array.isArray(order.materialUsage) ? order.materialUsage.length : 0,
                        cpeCount: order.collectedCPEs?.length || 0,
                    });
                }
            } catch (err) {
                console.error('[EVENT-HANDLER-ERROR] Failed to send completion notification:', err);
            }
        }

        // 3. RETURN → Notify managers
        // NOTE: Material rollback is handled INSIDE the main PATCH transaction in sod/index.ts
        // for atomic consistency. This handler only sends the return notification. A return is a
        // side band, not a rank move, so it is announced on any transition into it.
        if (newStatus === 'RETURN') {
            try {
                const { NotificationPolicyService } = await import('../../services/notification/notification-policy.service');
                await NotificationPolicyService.notifySODReturn({
                    id: serviceOrderId,
                    soNum,
                    opmcId,
                    returnReason
                });
            } catch (err) {
                console.error('[EVENT-HANDLER-ERROR] Failed to send return notification:', err);
            }
        }
    });
}
