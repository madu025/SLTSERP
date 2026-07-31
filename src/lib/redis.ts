import Redis from 'ioredis';

const redisGlobal = global as unknown as { redis: Redis | undefined };

const isProduction = process.env.NODE_ENV === 'production';
const isVercel = process.env.VERCEL === '1';

export const redis = (() => {
    if (redisGlobal.redis && ['end', 'close'].includes(redisGlobal.redis.status)) {
        redisGlobal.redis.disconnect();
        redisGlobal.redis = undefined;
    }

    const client = redisGlobal.redis ?? new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
        enableOfflineQueue: false, // Prevent queuing commands when Redis is down
        maxRetriesPerRequest: 2,
        connectTimeout: 2000,
        retryStrategy(times) {
            if (times > 2) return null; // Stop retrying after 2 attempts
            return 200;
        }
    });

    return client;
})();

// Prevent unhandled error events from crashing the process
redis.on('error', (err) => {
    // Suppress ECONNREFUSED noise when Redis is not running locally or during build
    if (err?.message?.includes('ECONNREFUSED') || (err as any)?.code === 'ECONNREFUSED') {
        return;
    }
    console.warn('[REDIS] Non-fatal connection issue:', err.message);
});

if (!isProduction) {
    redisGlobal.redis = redis;
}

export default redis;
