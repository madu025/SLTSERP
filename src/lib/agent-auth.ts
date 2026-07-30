import crypto from 'crypto';
import { verifyJWT } from './auth';
import { checkRateLimit } from './rate-limiter';
import { logger } from './logger';

const isProduction = process.env.NODE_ENV === 'production';
const rawAgentKey = process.env.AGENT_API_KEY;

// Production check moved inside validation function to prevent build crashes

const validApiKey = rawAgentKey || 'slts-agent-secure-sync-key-2026';

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
 * Delegated unified rate-limiter using Redis. Fails open on Redis error with alert tracking.
 */
export async function rateLimit(ip: string, limit: number = 10, windowSeconds: number = 60): Promise<boolean> {
    const result = await checkRateLimit(ip, {
        max: limit,
        windowSecs: windowSeconds,
        prefix: 'ratelimit:agent',
    });
    return result.allowed;
}

/**
 * Constant-time string comparison to prevent timing attacks.
 */
function safeCompare(a: string, b: string): boolean {
    try {
        const bufA = Buffer.from(a);
        const bufB = Buffer.from(b);
        if (bufA.length !== bufB.length) return false;
        return crypto.timingSafeEqual(bufA, bufB);
    } catch {
        return false;
    }
}

/**
 * Validates agent authentication via static API key or short-lived Bearer JWT.
 * Logs failed authentication attempts.
 */
export async function validateAgentAuth(req: Request): Promise<{ success: boolean; errorResponse?: Response }> {
    const apiKeyHeader = req.headers.get('x-api-key') || req.headers.get('X-API-Key');
    const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
    
    if (isProduction && (!rawAgentKey || rawAgentKey === 'slts-agent-secure-sync-key-2026')) {
        throw new Error('[FATAL SECURITY CONFIG] AGENT_API_KEY must be set to a strong secret in production.');
    }

    // 1. Check static API key with timing-safe comparison
    if (apiKeyHeader && safeCompare(apiKeyHeader, validApiKey)) {
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
    logger.warn('[AGENT_AUTH_FAILED]', { ip, method, path: url });
    
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
