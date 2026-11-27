import { redis, scanKeys } from './redis';
import { logger } from './logger';
import { getRequestId } from './request-context';

let cacheErrorCount = 0;
let cacheHits = 0;
let cacheMisses = 0;

export class CacheService {
    /**
     * The request client is lazy (lazyConnect) and has no offline queue. Checking only for 'ready' meant that a client
     * nobody else had woken up yet stayed in 'wait' and every cache read was skipped: the cache was silently off.
     * A client that is not connected is now asked to connect in the background; this call still never waits.
     */
    private static isReady(): boolean {
        if (redis.status === 'wait' || redis.status === 'end' || redis.status === 'close') {
            redis.connect().catch(() => undefined);
        }
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

    /**
     * The app's own cache hits and misses since start (exported on /api/metrics). Redis's keyspace_hits/misses cannot
     * show this: most of its lookups are the BullMQ workers polling empty queues, each counted as a miss.
     */
    static getHitMetrics() {
        return { cacheHits, cacheMisses };
    }

    static async get<T>(key: string): Promise<T | null> {
        if (!CacheService.isReady()) { cacheMisses++; return null; }
        try {
            const data = await redis.get(key);
            if (!data) { cacheMisses++; return null; }
            cacheHits++;
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
            const keys = await scanKeys(pattern);
            if (keys.length > 0) {
                await redis.del(...keys);
            }
        } catch (e) {
            CacheService.logCacheWarn('delPattern', pattern, e);
        }
    }
}
