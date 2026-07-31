import { redis } from '@/lib/redis';

export interface TrafficMetric {
    identifier: string;
    hits: number;
    ttl: number;
}

export class TrafficService {
    private static readonly BLACKLIST_KEY = 'global:blacklist';

    /**
     * Gets all active rate limit keys matching 'ratelimit:*'
     */
    static async getLiveTraffic(): Promise<TrafficMetric[]> {
        const keys = await redis.keys('ratelimit:*');
        if (keys.length === 0) return [];

        const pipeline = redis.pipeline();
        keys.forEach(key => {
            pipeline.get(key);
            pipeline.ttl(key);
        });

        const results = await pipeline.exec();
        const metrics: TrafficMetric[] = [];

        if (results) {
            for (let i = 0; i < keys.length; i++) {
                const identifier = keys[i].replace('ratelimit:', '');
                const hits = Number(results[i * 2][1]) || 0;
                const ttl = Number(results[i * 2 + 1][1]) || 0;
                
                metrics.push({ identifier, hits, ttl });
            }
        }

        return metrics.sort((a, b) => b.hits - a.hits);
    }

    static async getBlockedList(): Promise<string[]> {
        return await redis.smembers(this.BLACKLIST_KEY);
    }

    static async blockEntity(identifier: string): Promise<void> {
        await redis.sadd(this.BLACKLIST_KEY, identifier);
    }

    static async unblockEntity(identifier: string): Promise<void> {
        await redis.srem(this.BLACKLIST_KEY, identifier);
    }

    /**
     * Quickly check if an entity is blocked (used by middleware)
     */
    static async isBlocked(identifier: string): Promise<boolean> {
        try {
            return await redis.sismember(this.BLACKLIST_KEY, identifier) === 1;
        } catch (error) {
            console.warn(`[TrafficService] Redis unavailable for isBlocked check on ${identifier}`);
            return false;
        }
    }
}
