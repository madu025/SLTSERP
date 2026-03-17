import Redis from 'ioredis';

const redisGlobal = global as unknown as { redis: Redis | undefined };

export const redis = redisGlobal.redis ?? new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
    maxRetriesPerRequest: null, // Required for BullMQ
});

// Prevent unhandled error events from crashing the process
redis.on('error', (err) => {
    // We only log if it's not a connection error that ioredis will retry anyway
    if (process.env.NODE_ENV !== 'production' || err.message.includes('ECONNREFUSED')) {
        // Suppress noisy logs in dev, or at least prevent crash
    } else {
        console.error('Redis error:', err);
    }
});

if (process.env.NODE_ENV !== 'production') {
    redisGlobal.redis = redis;
}

export default redis;
