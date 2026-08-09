import { eventBus } from './events/event-bus';
import type { EventMap } from './events/event-bus.interface';

export const NOTIFICATION_EVENT = 'new-notification';
export const SYSTEM_EVENT = 'system-event';

/**
 * Emit a notification via EventBus to a specific user.
 * Uses a dynamic per-user channel (not in EventMap -- fallback payload shape).
 */
export const emitNotification = async <T extends Record<string, unknown> = Record<string, unknown>>(userId: string, data: T) => {
    await eventBus.publish(`${NOTIFICATION_EVENT}:${userId}`, data);
};

/**
 * Subscribe to notifications for a specific user via EventBus
 */
export const subscribeToNotifications = (userId: string, callback: (data: Record<string, unknown>) => void) => {
    return eventBus.subscribe(`${NOTIFICATION_EVENT}:${userId}`, callback);
};

/**
 * Emit a system-wide event (typed via EventMap)
 */
export const emitSystemEvent = async (type: string, data: Record<string, unknown> = {}) => {
    await eventBus.publish(SYSTEM_EVENT, { type, ...data });
};

/**
 * Subscribe to system events (typed via EventMap)
 */
export const subscribeToSystemEvents = (callback: (data: EventMap['system-event']) => void) => {
    return eventBus.subscribe(SYSTEM_EVENT, callback);
};
