import { redis } from './redis';
import { verifyJWT } from './auth';

/**
 * Resolves the client IP address from request headers.
 */
export function getClientIp(req: Request): string {
    const xForwardedFor = req.headers.get('x-forwarded-for');
    if (xForwardedFor) {
        return xForwardedFor.split(',')[0].trim();
    }
    return req.headers.get('x-real-ip') || '127.0.0.1';
}

/**
 * Basic rate-limiter using Redis. Fails open (allows request) if Redis is offline/unreachable.
 */
export async function rateLimit(ip: string, limit: number = 10, windowSeconds: number = 60): Promise<boolean> {
    const key = `ratelimit:agent:${ip}`;
    try {
        const pipeline = redis.multi();
        pipeline.incr(key);
        pipeline.ttl(key);
        const results = await pipeline.exec();
        
        if (!results) {
            return true;
        }
        
        // ioredis multi results are arrays of [err, result]
        const count = results[0][1] as number;
        let ttl = results[1][1] as number;
        
        if (count === 1 || ttl === -1) {
            await redis.expire(key, windowSeconds);
        }
        
        return count <= limit;
    } catch (error) {
        console.error('[RATELIMIT] Redis rate limit error:', error);
        return true; // Fail open
    }
}

/**
 * Validates agent authentication via static API key or short-lived Bearer JWT.
 * Logs failed authentication attempts.
 */
export async function validateAgentAuth(req: Request): Promise<{ success: boolean; errorResponse?: Response }> {
    const apiKeyHeader = req.headers.get('x-api-key') || req.headers.get('X-API-Key');
    const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
    
    const validApiKey = process.env.AGENT_API_KEY || 'slts-agent-secure-sync-key-2026';
    
    // 1. Check static API key
    if (apiKeyHeader === validApiKey) {
        return { success: true };
    }
    
    // 2. Check Bearer JWT token
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        const payload = await verifyJWT(token);
        if (payload && payload.role === 'agent') {
            return { success: true };
        }
    }
    
    // 3. Failed auth attempt
    const ip = getClientIp(req);
    const method = req.method;
    const url = new URL(req.url).pathname;
    console.warn(`[AGENT_AUTH_FAILED] Failed authentication attempt from IP: ${ip} for ${method} ${url}`);
    
    return {
        success: false,
        errorResponse: new Response(
            JSON.stringify({ success: false, message: 'Invalid credentials' }),
            {
                status: 401,
                headers: { 'Content-Type': 'application/json' }
            }
        )
    };
}
