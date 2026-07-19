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

        // 2. COMPLETED → Notify managers/engineers
        if (newStatus === 'COMPLETED') {
            try {
                const { prisma } = await import('../prisma');
                const order = await prisma.serviceOrder.findUnique({
                    where: { id: serviceOrderId },
                    select: { soNum: true, customerName: true, opmcId: true, materialUsage: true, collectedCPEs: { select: { id: true } } }
                });
                if (order) {
                    const { DomainNotificationPolicies } = await import('../../services/notification/domain-policies.service');
                    await DomainNotificationPolicies.notifySODCompleted({
                        soNum: order.soNum,
                        customerName: order.customerName || undefined,
                        completedByUserId: userId,
                        opmcId: order.opmcId || undefined,
                        materialsCount: Array.isArray(order.materialUsage) ? order.materialUsage.length : 0,
                        cpeCount: order.collectedCPEs?.length || 0,
                    });
                }
            } catch (err) {
                console.error('[EVENT-HANDLER-ERROR] Failed to send completion notification:', err);
            }
        }

        // 3. ASSIGNED → Notify assigned team + managers
        if (newStatus === 'ASSIGNED' && oldStatus !== 'ASSIGNED') {
            try {
                const { prisma } = await import('../prisma');
                const order = await prisma.serviceOrder.findUnique({
                    where: { id: serviceOrderId },
                    select: { soNum: true, customerName: true, opmcId: true, contractorId: true, contractor: { select: { name: true } } }
                });
                if (order) {
                    const { DomainNotificationPolicies } = await import('../../services/notification/domain-policies.service');
                    await DomainNotificationPolicies.notifySODAssignment({
                        soNum: order.soNum,
                        customerName: order.customerName || undefined,
                        contractorName: order.contractor?.name || undefined,
                        opmcId: order.opmcId || undefined,
                    });
                }
            } catch (err) {
                console.error('[EVENT-HANDLER-ERROR] Failed to send assignment notification:', err);
            }
        }

        // 4. RETURN → Notify managers
        // NOTE: Material rollback is handled INSIDE the main PATCH transaction in sod/index.ts
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
