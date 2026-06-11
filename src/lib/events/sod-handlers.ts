import { eventBus } from './event-bus';

export function registerSODEventHandlers() {
    eventBus.subscribe('sod.status_changed', async (payload) => {
        const {
            serviceOrderId,
            soNum,
            opmcId,
            oldStatus,
            newStatus,
            returnReason,
            userId
        } = payload;

        try {
            // 1. Stats Recalculation
            const { StatsService } = await import('../stats.service');
            await StatsService.handleStatusChange(opmcId, oldStatus || 'PENDING', newStatus);
        } catch (err) {
            console.error('[EVENT-HANDLER-ERROR] Failed to handle status change stats update:', err);
        }

        // 2. Return Specific logic: Notification only
        // NOTE: Material rollback is now handled INSIDE the main PATCH transaction in sod/index.ts
        // for atomic consistency. This handler only sends the return notification.
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
