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

        // 2. Return Specific logic: Notification & Material Usage Rollback
        if (newStatus === 'RETURN') {
            try {
                const { SODMaterialService } = await import('../../services/sod/sod.material.service');
                const { prisma } = await import('../prisma');
                await prisma.$transaction(async (tx) => {
                    await SODMaterialService.rollbackMaterialUsage(tx, serviceOrderId, userId || 'SYSTEM');
                });
            } catch (err) {
                console.error('[EVENT-HANDLER-ERROR] Failed to rollback material usage on SOD return:', err);
            }

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
