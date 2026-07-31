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
        enableOfflineQueue: isProduction, // Fail instantly if Redis is down in local dev
        maxRetriesPerRequest: (isVercel || !isProduction) ? 3 : null,
        connectTimeout: 2000, // 2 seconds
        retryStrategy(times) {
            if (isVercel || !isProduction) {
                if (times > 2) return null;
                return 200; // Fast retry
            }
            return Math.min(times * 100, 3000);
        }
    });

    return client;
})();

// Prevent unhandled error events from crashing the process
redis.on('error', (err) => {
    // We only log if it's not a connection error that ioredis will retry anyway
    if (!isProduction || err.message.includes('ECONNREFUSED')) {
        // Suppress noisy logs in dev, or at least prevent crash
    } else {
        console.error('Redis error:', err);
    }
});

if (!isProduction) {
    redisGlobal.redis = redis;
}

export default redis;
