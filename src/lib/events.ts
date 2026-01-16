import { redis } from './redis';
import Redis from 'ioredis';

// Separate connection for subscribing as it blocks the client
let subscriber: Redis | null = null;

const getSubscriber = () => {
    if (!subscriber) {
        subscriber = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
            maxRetriesPerRequest: null,
        });
    }
    return subscriber;
};

export const NOTIFICATION_EVENT = 'new-notification';
export const SYSTEM_EVENT = 'system-event';

/**
 * Emit a notification via Redis Pub/Sub
 */
export const emitNotification = async (userId: string, data: any) => {
    await redis.publish(`${NOTIFICATION_EVENT}:${userId}`, JSON.stringify(data));
};

/**
 * Subscribe to notifications for a specific user via Redis Pub/Sub
 */
export const subscribeToNotifications = (userId: string, callback: (data: any) => void) => {
    const sub = getSubscriber();
    const channel = `${NOTIFICATION_EVENT}:${userId}`;

    sub.subscribe(channel);

    const handler = (chan: string, message: string) => {
        if (chan === channel) {
            callback(JSON.parse(message));
        }
    };

    sub.on('message', handler);

    return () => {
        sub.off('message', handler);
        // We don't necessarily unsubscribe the channel here if other listeners exist, 
        // but in a typical SSE route this is fine.
    };
};

/**
 * Emit a system-wide event
 */
export const emitSystemEvent = async (type: string, data: any = {}) => {
    await redis.publish(SYSTEM_EVENT, JSON.stringify({ type, ...data }));
};

/**
 * Subscribe to system events
 */
export const subscribeToSystemEvents = (callback: (data: any) => void) => {
    const sub = getSubscriber();

    sub.subscribe(SYSTEM_EVENT);

    const handler = (chan: string, message: string) => {
        if (chan === SYSTEM_EVENT) {
            callback(JSON.parse(message));
        }
    };

    sub.on('message', handler);

    return () => {
        sub.off('message', handler);
    };
};

