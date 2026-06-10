import { redis } from '../redis';
import Redis from 'ioredis';
import { EventBus } from './event-bus.interface';

export class RedisEventBus implements EventBus {
    private subscriber: Redis | null = null;
    private handlers = new Map<string, Set<(data: any) => void>>();

    private getSubscriber(): Redis {
        if (!this.subscriber) {
            this.subscriber = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
                maxRetriesPerRequest: null,
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
                            try {
                                cb(parsed);
                            } catch (cbErr) {
                                console.error(`Error in event handler for channel ${channel}:`, cbErr);
                            }
                        });
                    } catch (e) {
                        console.error(`Error parsing message on channel ${channel}:`, e);
                    }
                }
            });
        }
        return this.subscriber;
    }

    async publish(channel: string, data: unknown): Promise<void> {
        try {
            await redis.publish(channel, JSON.stringify(data));
        } catch (err) {
            console.error(`Failed to publish event to channel ${channel}:`, err);
        }
    }

    subscribe(channel: string, callback: (data: any) => void): () => void {
        const sub = this.getSubscriber();

        let set = this.handlers.get(channel);
        if (!set) {
            set = new Set();
            this.handlers.set(channel, set);
            sub.subscribe(channel).catch(err => {
                console.error(`Redis subscription failed for channel ${channel}:`, err);
            });
        }
        set.add(callback);

        return () => {
            const currentSet = this.handlers.get(channel);
            if (currentSet) {
                currentSet.delete(callback);
                if (currentSet.size === 0) {
                    this.handlers.delete(channel);
                    sub.unsubscribe(channel).catch(err => {
                        console.error(`Redis unsubscribe failed for channel ${channel}:`, err);
                    });
                }
            }
        };
    }
}

export const eventBus = new RedisEventBus();
