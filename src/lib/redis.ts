import Redis from 'ioredis';

const redisGlobal = global as unknown as { redis: Redis | undefined };

const isProduction = process.env.NODE_ENV === 'production';
const isVercel = process.env.VERCEL === '1';

export const redis = redisGlobal.redis ?? new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
    // BullMQ requires maxRetriesPerRequest to be null where background workers run.
    // On Vercel, background workers do not run and we want it to fail fast.
    maxRetriesPerRequest: (isVercel) ? 3 : null,
    connectTimeout: 5000, // 5 seconds
    retryStrategy(times) {
        if (isVercel) {
            // Stop retrying immediately on Vercel serverless functions
            return null;
        }
        return Math.min(times * 100, 3000);
    }
});

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
