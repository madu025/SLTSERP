import { redis } from '@/lib/redis';
import crypto from 'crypto';

export class NotificationDeduplicationService {
    /**
     * Checks if a notification with the same parameters has been emitted recently (default 30s TTL).
     * Returns true if it is a duplicate and should be suppressed.
     */
    static async isDuplicate(params: {
        userId: string;
        type: string;
        entityId?: string;
        message?: string;
        ttlSeconds?: number;
    }): Promise<boolean> {
        const { userId, type, entityId = '', message = '', ttlSeconds = 30 } = params;

        // Hash content to create unique deduplication key
        const contentHash = crypto
            .createHash('md5')
            .update(`${userId}:${type}:${entityId}:${message}`)
            .digest('hex');

        const redisKey = `notification:dedup:${contentHash}`;

        try {
            // SET key 1 EX ttlSeconds NX (Only set if not exists)
            const result = await redis.set(redisKey, '1', 'EX', ttlSeconds, 'NX');
            // If result is null, the key already existed -> it's a duplicate!
            return result === null;
        } catch (err) {
            console.error('Deduplication Redis check failed:', err);
            // Fallback: If Redis is temporarily unreachable, do not block notifications
            return false;
        }
    }
}
