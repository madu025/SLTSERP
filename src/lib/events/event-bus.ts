import { redis } from '../redis';
import Redis from 'ioredis';
import { EventBus, FallbackPayload } from './event-bus.interface';
import { EventEmitter } from 'events';

const MAX_HANDLER_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 100;

/**
 * Execute an event handler with exponential backoff retry.
 * Prevents transient failures (e.g. momentary DB blip) from
 * permanently losing a notification.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function executeHandlerWithRetry(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    cb: (data: any) => void,
    parsed: unknown,
    channel: string,
): Promise<void> {
    for (let attempt = 1; attempt <= MAX_HANDLER_RETRIES; attempt++) {
        try {
            await cb(parsed);
            return;
        } catch (err) {
            if (attempt === MAX_HANDLER_RETRIES) {
                console.error(`[EventBus] Handler FAILED after ${MAX_HANDLER_RETRIES} retries on "${channel}":`, err);
            } else {
                const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1);
                console.warn(`[EventBus] Handler attempt ${attempt} failed on "${channel}", retrying in ${delay}ms...`);
                await new Promise(r => setTimeout(r, delay));
            }
        }
    }
}

export class RedisEventBus implements EventBus {
    private subscriber: Redis | null = null;
    private localEmitter = new EventEmitter();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private handlers = new Map<string, Set<(data: any) => void>>();

    constructor() {
        // Set higher limits for local event listeners if needed
        this.localEmitter.setMaxListeners(100);
    }

    private getSubscriber(): Redis {
        if (!this.subscriber) {
            this.subscriber = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
                maxRetriesPerRequest: null,
                connectTimeout: 2000,
                retryStrategy(times) {
                    if (process.env.NODE_ENV !== 'production') {
                        if (times > 2) return null;
                        return 500;
                    }
                    return Math.min(times * 100, 3000);
                }
            });
            this.subscriber.on('error', (err) => {
                if (process.env.NODE_ENV === 'production' && !err.message.includes('ECONNREFUSED')) {
                    console.error('Redis EventBus Subscriber Error:', err);
                }
            });

            this.subscriber.on('message', (channel: string, message: string) => {
                const set = this.handlers.get(channel);
                if (set) {
                    try {
                        const parsed = JSON.parse(message);
                        set.forEach(cb => {
                            executeHandlerWithRetry(cb, parsed, channel).catch(err => {
                                console.error(`[EventBus] Unhandled retry error on "${channel}":`, err);
                            });
                        });
                    } catch (e) {
                        console.error(`Error parsing message on channel ${channel}:`, e);
                    }
                }
            });
        }
        return this.subscriber;
    }

    async publish(channel: string, data: FallbackPayload): Promise<void> {
        // Always emit locally first to support seamless local development without active Redis
        try {
            this.localEmitter.emit(channel, data);
        } catch (err) {
            console.error(`Failed to publish event locally on channel ${channel}:`, err);
        }

        try {
            await redis.publish(channel, JSON.stringify(data));
        } catch (err) {
            // Only log redis errors in production or when explicitly debugging
            if (process.env.NODE_ENV === 'production') {
                console.error(`Failed to publish event to Redis channel ${channel}:`, err);
            }
        }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    subscribe(channel: string, callback: (data: any) => void): () => void {
        // Register local handler
        this.localEmitter.on(channel, callback);

        const sub = this.getSubscriber();

        let set = this.handlers.get(channel);
        if (!set) {
            set = new Set();
            this.handlers.set(channel, set);
            sub.subscribe(channel).catch(err => {
                if (process.env.NODE_ENV === 'production') {
                    console.error(`Redis subscription failed for channel ${channel}:`, err);
                }
            });
        }
        set.add(callback);

        return () => {
            this.localEmitter.off(channel, callback);

            const currentSet = this.handlers.get(channel);
            if (currentSet) {
                currentSet.delete(callback);
                if (currentSet.size === 0) {
                    this.handlers.delete(channel);
                    sub.unsubscribe(channel).catch(err => {
                        if (process.env.NODE_ENV === 'production') {
                            console.error(`Redis unsubscribe failed for channel ${channel}:`, err);
                        }
                    });
                }
            }
        };
    }
}

export const eventBus = new RedisEventBus();
