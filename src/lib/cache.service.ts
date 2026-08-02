import { redis } from './redis';
import { logger } from './logger';
import { getRequestId } from './request-context';

let cacheErrorCount = 0;

export class CacheService {
    private static isReady(): boolean {
        return redis.status === 'ready';
    }

    private static logCacheWarn(op: string, key: string, error: unknown): void {
        cacheErrorCount++;
        const reqId = getRequestId();
        const traceInfo = reqId ? `[ReqID: ${reqId}] ` : '';
        logger.warn(`${traceInfo}[CACHE SERVICE FAIL-OPEN] ${op} failed for key/pattern: ${key}`, {
            operation: op,
            key,
            cacheErrorCount,
            error: error instanceof Error ? error.message : String(error),
        });
    }

    /**
     * Total count of cache fail-open error occurrences since server startup
     */
    static getFailureMetrics() {
        return { cacheErrorCount };
    }

    static async get<T>(key: string): Promise<T | null> {
        if (!CacheService.isReady()) return null;
        try {
            const data = await redis.get(key);
            if (!data) return null;
            return JSON.parse(data) as T;
        } catch (e) {
            CacheService.logCacheWarn('get', key, e);
            return null;
        }
    }

    /**
     * Cache-Aside pattern: Get from cache, or fetch, set, and return.
     */
    static async getOrSet<T>(key: string, fetcher: () => Promise<T>, ttlSeconds: number = 3600): Promise<T> {
        const cached = await this.get<T>(key);
        if (cached !== null) return cached;

        const data = await fetcher();
        await this.set(key, data, ttlSeconds);
        return data;
    }

    static async set(key: string, value: unknown, ttlSeconds: number = 3600): Promise<void> {
        if (!CacheService.isReady()) return;
        try {
            const data = JSON.stringify(value);
            await redis.set(key, data, 'EX', ttlSeconds);
        } catch (e) {
            CacheService.logCacheWarn('set', key, e);
        }
    }

    static async del(key: string): Promise<void> {
        if (!CacheService.isReady()) return;
        try {
            await redis.del(key);
        } catch (e) {
            CacheService.logCacheWarn('del', key, e);
        }
    }

    static async delPattern(pattern: string): Promise<void> {
        if (!CacheService.isReady()) return;
        try {
            const keys = await redis.keys(pattern);
            if (keys.length > 0) {
                await redis.del(...keys);
            }
        } catch (e) {
            CacheService.logCacheWarn('delPattern', pattern, e);
        }
    }
}
