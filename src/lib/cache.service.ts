import { redis } from './redis';

export class CacheService {
    static async get<T>(key: string): Promise<T | null> {
        const data = await redis.get(key);
        if (!data) return null;
        try {
            return JSON.parse(data) as T;
        } catch (e) {
            console.error(`Cache parse error for key ${key}:`, e);
            return null;
        }
    }

    static async set(key: string, value: unknown, ttlSeconds: number = 3600): Promise<void> {
        const data = JSON.stringify(value);
        await redis.set(key, data, 'EX', ttlSeconds);
    }

    static async del(key: string): Promise<void> {
        await redis.del(key);
    }

    static async delPattern(pattern: string): Promise<void> {
        const keys = await redis.keys(pattern);
        if (keys.length > 0) {
            await redis.del(...keys);
        }
    }
}
