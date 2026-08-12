import { redis } from './redis';
import { logger } from './logger';

export interface RateLimitOptions {
    max: number;
    windowSecs: number;
    prefix?: string;
}

export interface RateLimitResult {
    allowed: boolean;
    current: number;
    remaining: number;
    resetSecs: number;
}

let failOpenCount = 0;

/**
 * Enterprise Unified Redis Rate Limiter.
 * Uses Redis multi/pipeline (incr + ttl) for atomic, windowed rate limiting.
 * Fails open on Redis error, but tracks and logs metrics for alerting.
 */
export async function checkRateLimit(
    identifier: string,
    options: RateLimitOptions
): Promise<RateLimitResult> {
    const prefix = options.prefix ?? 'ratelimit';
    const key = `${prefix}:${identifier}`;

    try {
        const pipeline = redis.multi();
        pipeline.incr(key);
        pipeline.ttl(key);
        const results = await pipeline.exec();

        if (!results || results.length < 2) {
            return { allowed: true, current: 0, remaining: options.max, resetSecs: options.windowSecs };
        }

        const count = (results[0][1] as number) ?? 1;
        let ttl = (results[1][1] as number) ?? -1;

        if (count === 1 || ttl < 0) {
            await redis.expire(key, options.windowSecs);
            ttl = options.windowSecs;
        }

        const allowed = count <= options.max;
        const remaining = Math.max(0, options.max - count);

        return {
            allowed,
            current: count,
            remaining,
            resetSecs: ttl > 0 ? ttl : options.windowSecs,
        };
    } catch (error: unknown) {
        failOpenCount++;
        logger.warn('[RATE-LIMIT-FAIL-OPEN]', {
            key,
            failOpenCount,
            error: error instanceof Error ? error.message : String(error),
        });

        // Fail open: allow request when Redis is degraded
        return {
            allowed: true,
            current: 0,
            remaining: options.max,
            resetSecs: options.windowSecs,
        };
    }
}

