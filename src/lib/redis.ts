import Redis from 'ioredis';

const redisGlobal = global as unknown as { redis: Redis | undefined };

export const redis = redisGlobal.redis ?? new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
    maxRetriesPerRequest: null, // Required for BullMQ
});

if (process.env.NODE_ENV !== 'production') {
    redisGlobal.redis = redis;
}

export default redis;
