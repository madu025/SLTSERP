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

// ─── In-Memory Fallback Rate Limiter ─────────────────────────────────────────
// When Redis is unavailable, this Map-based limiter prevents brute-force attacks
// on authentication endpoints. Keys expire after windowSecs * 2 (generous cleanup).
const memoryLimiter = new Map<string, { count: number; expiresAt: number }>();
let lastMemoryCleanup = 0;
const MEMORY_CLEANUP_INTERVAL = 60_000; // purge stale entries every 60s

function memoryFallbackCheck(
    identifier: string,
    options: RateLimitOptions
): RateLimitResult {
    const now = Date.now();

    // Periodic cleanup of expired entries (lazy, not on every request)
    if (now - lastMemoryCleanup > MEMORY_CLEANUP_INTERVAL) {
        lastMemoryCleanup = now;
        for (const [key, entry] of memoryLimiter) {
            if (entry.expiresAt < now) memoryLimiter.delete(key);
        }
    }

    const key = `${options.prefix ?? 'ratelimit'}:mem:${identifier}`;
    const entry = memoryLimiter.get(key);

    if (!entry || entry.expiresAt < now) {
        memoryLimiter.set(key, { count: 1, expiresAt: now + options.windowSecs * 1000 });
        return { allowed: true, current: 1, remaining: options.max - 1, resetSecs: options.windowSecs };
    }

    entry.count++;
    const allowed = entry.count <= options.max;
    const remaining = Math.max(0, options.max - entry.count);
    const resetSecs = Math.ceil((entry.expiresAt - now) / 1000);

    return { allowed, current: entry.count, remaining, resetSecs };
}

/**
 * Enterprise Unified Redis Rate Limiter.
 * Uses Redis multi/pipeline (incr + ttl) for atomic, windowed rate limiting.
 * Falls back to in-memory limiter on Redis error (never fails fully open).
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
        logger.warn('[RATE-LIMIT-REDIS-DOWN-FALLBACK-MEMORY]', {
            key,
            failOpenCount,
            error: error instanceof Error ? error.message : String(error),
        });

        // Fall back to in-memory limiter instead of failing open
        return memoryFallbackCheck(identifier, options);
    }
}

