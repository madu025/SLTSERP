import { EventEmitter } from 'events';

// Global event emitter for real-time notifications
// In production with multiple instances, use Redis Pub/Sub
const notificationEvents = new EventEmitter();

export const NOTIFICATION_EVENT = 'new-notification';

export const emitNotification = (userId: string, data: any) => {
    notificationEvents.emit(`${NOTIFICATION_EVENT}:${userId}`, data);
};

export const subscribeToNotifications = (userId: string, callback: (data: any) => void) => {
    notificationEvents.on(`${NOTIFICATION_EVENT}:${userId}`, callback);
    return () => {
        notificationEvents.off(`${NOTIFICATION_EVENT}:${userId}`, callback);
    };
};
