/**
 * Simple in-memory cache for frequently accessed data
 * Reduces database egress by caching results
 */

interface CacheEntry<T> {
    data: T;
    timestamp: number;
    ttl: number; // Time to live in milliseconds
}

class SimpleCache {
    private cache: Map<string, CacheEntry<any>> = new Map();

    /**
     * Get cached data or execute function if cache miss
     */
    async get<T>(
        key: string,
        fetchFn: () => Promise<T>,
        ttl: number = 60000 // Default 1 minute
    ): Promise<T> {
        const cached = this.cache.get(key);
        const now = Date.now();

        // Return cached data if valid
        if (cached && (now - cached.timestamp) < cached.ttl) {
            console.log(`[CACHE HIT] ${key}`);
            return cached.data as T;
        }

        // Cache miss - fetch fresh data
        console.log(`[CACHE MISS] ${key}`);
        const data = await fetchFn();

        // Store in cache
        this.cache.set(key, {
            data,
            timestamp: now,
            ttl
        });

        return data;
    }

    /**
     * Invalidate specific cache key
     */
    invalidate(key: string) {
        this.cache.delete(key);
        console.log(`[CACHE INVALIDATE] ${key}`);
    }

    /**
     * Invalidate all cache entries matching pattern
     */
    invalidatePattern(pattern: string) {
        const regex = new RegExp(pattern);
        for (const key of this.cache.keys()) {
            if (regex.test(key)) {
                this.cache.delete(key);
            }
        }
        console.log(`[CACHE INVALIDATE PATTERN] ${pattern}`);
    }

    /**
     * Clear all cache
     */
    clear() {
        this.cache.clear();
        console.log('[CACHE CLEAR] All cache cleared');
    }

    /**
     * Get cache stats
     */
    getStats() {
        return {
            size: this.cache.size,
            keys: Array.from(this.cache.keys())
        };
    }
}

// Export singleton instance
export const cache = new SimpleCache();

// Cache TTL constants (in milliseconds)
export const CACHE_TTL = {
    DASHBOARD_STATS: 5 * 60 * 1000,      // 5 minutes
    OPMC_LIST: 10 * 60 * 1000,           // 10 minutes
    USER_PERMISSIONS: 15 * 60 * 1000,    // 15 minutes
    TABLE_SETTINGS: 30 * 60 * 1000,      // 30 minutes
    SYSTEM_CONFIG: 60 * 60 * 1000,       // 1 hour
} as const;
