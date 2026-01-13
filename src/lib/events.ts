import { EventEmitter } from 'events';

// Global event emitter for real-time notifications
// In production with multiple instances, use Redis Pub/Sub
const notificationEvents = new EventEmitter();

export const NOTIFICATION_EVENT = 'new-notification';
export const SYSTEM_EVENT = 'system-event';

export const emitNotification = (userId: string, data: any) => {
    notificationEvents.emit(`${NOTIFICATION_EVENT}:${userId}`, data);
};

export const subscribeToNotifications = (userId: string, callback: (data: any) => void) => {
    notificationEvents.on(`${NOTIFICATION_EVENT}:${userId}`, callback);
    return () => {
        notificationEvents.off(`${NOTIFICATION_EVENT}:${userId}`, callback);
    };
};

export const emitSystemEvent = (type: string, data: any = {}) => {
    notificationEvents.emit(SYSTEM_EVENT, { type, ...data });
};

export const subscribeToSystemEvents = (callback: (data: any) => void) => {
    notificationEvents.on(SYSTEM_EVENT, callback);
    return () => {
        notificationEvents.off(SYSTEM_EVENT, callback);
    };
};
