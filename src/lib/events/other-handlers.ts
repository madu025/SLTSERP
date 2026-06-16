import { eventBus } from './event-bus';

export function registerOtherEventHandlers() {
    // 1. Stock Request Created
    eventBus.subscribe('inventory.stock_request_created', async (payload) => {
        try {
            const { NotificationPolicyService } = await import('../../services/notification/notification-policy.service');
            await NotificationPolicyService.notifyStockRequestCreated(payload.request, payload.stage);
        } catch (err) {
            console.error('[EVENT-HANDLER-ERROR] notifyStockRequestCreated failed:', err);
        }
    });

    // 2. Stock Request Stage Changed
    eventBus.subscribe('inventory.stock_request_stage_changed', async (payload) => {
        try {
            const { NotificationPolicyService } = await import('../../services/notification/notification-policy.service');
            await NotificationPolicyService.notifyStockRequestStageChange(payload.request, payload.stage, payload.roles);
        } catch (err) {
            console.error('[EVENT-HANDLER-ERROR] notifyStockRequestStageChange failed:', err);
        }
    });

    // 3. Stock Request Finalized
    eventBus.subscribe('inventory.stock_request_finalized', async (payload) => {
        try {
            const { NotificationPolicyService } = await import('../../services/notification/notification-policy.service');
            await NotificationPolicyService.notifyStockRequestFinalAction(payload.request, payload.action, payload.remarks);
        } catch (err) {
            console.error('[EVENT-HANDLER-ERROR] notifyStockRequestFinalAction failed:', err);
        }
    });

    // 4. Low Stock Detected
    eventBus.subscribe('inventory.low_stock_detected', async (payload) => {
        try {
            const { NotificationPolicyService } = await import('../../services/notification/notification-policy.service');
            await NotificationPolicyService.notifyLowStock(payload.store, payload.item, payload.currentStock, payload.minStock);
        } catch (err) {
            console.error('[EVENT-HANDLER-ERROR] notifyLowStock failed:', err);
        }
    });

    // 5. Contractor Registered
    eventBus.subscribe('contractor.registered', async (payload) => {
        try {
            const { NotificationPolicyService } = await import('../../services/notification/notification-policy.service');
            await NotificationPolicyService.notifyContractorSubmission(payload.contractor);
        } catch (err) {
            console.error('[EVENT-HANDLER-ERROR] notifyContractorSubmission failed:', err);
        }
    });

    // 6. Contractor Status Changed
    eventBus.subscribe('contractor.status_changed', async (payload) => {
        try {
            const { NotificationPolicyService } = await import('../../services/notification/notification-policy.service');
            await NotificationPolicyService.notifyContractorStatusChange(payload.contractor, payload.status, payload.rejectionReason);
        } catch (err) {
            console.error('[EVENT-HANDLER-ERROR] notifyContractorStatusChange failed:', err);
        }
    });
}
