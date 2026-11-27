import Redis from 'ioredis';

const redisGlobal = global as unknown as { redis: Redis | undefined };

const isProduction = process.env.NODE_ENV === 'production';

export const redis = (() => {
    if (redisGlobal.redis && ['end', 'close'].includes(redisGlobal.redis.status)) {
        redisGlobal.redis.disconnect();
        redisGlobal.redis = undefined;
    }

    const client = redisGlobal.redis ?? new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
        lazyConnect: true,
        enableOfflineQueue: false, // Prevent queuing commands when Redis is down
        maxRetriesPerRequest: 2,
        connectTimeout: 2000,
        // Requests never wait (enableOfflineQueue false, 2 retries per command), but the long-running production server
        // keeps reconnecting in the background: with "give up after 2 attempts" one dropped socket left this singleton
        // dead until the next restart (Redis "unhealthy" in health, found by the Redis audit, 27 Nov 2026).
        // Local runs without Redis still give up quickly.
        retryStrategy(times) {
            if (!isProduction && times > 2) return null;
            return Math.min(200 * times, 5000);
        }
    });

    return client;
})();

// Prevent unhandled error events from crashing the process
redis.on('error', (err) => {
    // Suppress ECONNREFUSED noise when Redis is not running locally or during build
    const errCode = (err as unknown as Record<string, unknown>)?.code;
    if (err?.message?.includes('ECONNREFUSED') || errCode === 'ECONNREFUSED') {
        return;
    }
    console.warn('[REDIS] Non-fatal connection issue:', err.message);
});

if (!isProduction) {
    redisGlobal.redis = redis;
}

/**
 * Every key matching a pattern, read with SCAN in small steps instead of KEYS. KEYS walks the whole keyspace in one
 * blocking call (it stalls the BullMQ workers on the same Redis) and is refused for the app's ACL user (-@dangerous).
 * SCAN may return a key twice, so the result is de-duplicated.
 */
export async function scanKeys(pattern: string, count = 200): Promise<string[]> {
    const found = new Set<string>();
    let cursor = '0';
    do {
        const [next, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', count);
        for (const k of keys) found.add(k);
        cursor = next;
    } while (cursor !== '0');
    return [...found];
}

export default redis;
