import { eventBus } from './events/event-bus';

export const NOTIFICATION_EVENT = 'new-notification';
export const SYSTEM_EVENT = 'system-event';

/**
 * Emit a notification via EventBus
 */
export const emitNotification = async (userId: string, data: any) => {
    await eventBus.publish(`${NOTIFICATION_EVENT}:${userId}`, data);
};

/**
 * Subscribe to notifications for a specific user via EventBus
 */
export const subscribeToNotifications = (userId: string, callback: (data: any) => void) => {
    return eventBus.subscribe(`${NOTIFICATION_EVENT}:${userId}`, callback);
};

/**
 * Emit a system-wide event
 */
export const emitSystemEvent = async (type: string, data: any = {}) => {
    await eventBus.publish(SYSTEM_EVENT, { type, ...data });
};

/**
 * Subscribe to system events
 */
export const subscribeToSystemEvents = (callback: (data: any) => void) => {
    return eventBus.subscribe(SYSTEM_EVENT, callback);
};
