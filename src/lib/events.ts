import { eventBus } from './events/event-bus';

export const NOTIFICATION_EVENT = 'new-notification';
export const SYSTEM_EVENT = 'system-event';

/**
 * Emit a notification via EventBus
 */
export const emitNotification = async <T = Record<string, unknown>>(userId: string, data: T) => {
    await eventBus.publish(`${NOTIFICATION_EVENT}:${userId}`, data);
};

/**
 * Subscribe to notifications for a specific user via EventBus
 */
export const subscribeToNotifications = <T = Record<string, unknown>>(userId: string, callback: (data: T) => void) => {
    return eventBus.subscribe(`${NOTIFICATION_EVENT}:${userId}`, callback as (data: unknown) => void);
};

/**
 * Emit a system-wide event
 */
export const emitSystemEvent = async (type: string, data: Record<string, unknown> = {}) => {
    await eventBus.publish(SYSTEM_EVENT, { type, ...data });
};

/**
 * Subscribe to system events
 */
export const subscribeToSystemEvents = <T = Record<string, unknown>>(callback: (data: T) => void) => {
    return eventBus.subscribe(SYSTEM_EVENT, callback as (data: unknown) => void);
};
