import { redis } from './redis';

export class CacheService {
    static async get<T>(key: string): Promise<T | null> {
        try {
            const data = await redis.get(key);
            if (!data) return null;
            return JSON.parse(data) as T;
        } catch (e) {
            console.warn(`[CACHE SERVICE ERROR] get failed for key ${key} (falling back):`, e);
            return null;
        }
    }

    static async set(key: string, value: unknown, ttlSeconds: number = 3600): Promise<void> {
        try {
            const data = JSON.stringify(value);
            await redis.set(key, data, 'EX', ttlSeconds);
        } catch (e) {
            console.warn(`[CACHE SERVICE ERROR] set failed for key ${key} (skipping cache write):`, e);
        }
    }

    static async del(key: string): Promise<void> {
        try {
            await redis.del(key);
        } catch (e) {
            console.warn(`[CACHE SERVICE ERROR] del failed for key ${key} (skipping cache invalidation):`, e);
        }
    }

    static async delPattern(pattern: string): Promise<void> {
        try {
            const keys = await redis.keys(pattern);
            if (keys.length > 0) {
                await redis.del(...keys);
            }
        } catch (e) {
            console.warn(`[CACHE SERVICE ERROR] delPattern failed for pattern ${pattern} (skipping cache invalidation):`, e);
        }
    }
}
