const Redis = require('ioredis');

// Direct connection to Redis server on Lightsail (assuming standard port)
// If running locally, you might be connecting to a local Redis or the remote one via SSH tunnel
// Since we don't have direct external access configured, we'll try standard localhost (if you have local redis)
// OR skip if no Redis is available.

const connectRedis = async () => {
    try {
        const redis = new Redis({
            host: '127.0.0.1',
            port: 6379,
            maxRetriesPerRequest: 1
        });

        await redis.flushall();
        console.log("✅ Redis Cache Cleared Successfully!");
        process.exit(0);
    } catch (error) {
        console.error("❌ Failed to clear Redis:", error.message);
        process.exit(1);
    }
};

connectRedis();
