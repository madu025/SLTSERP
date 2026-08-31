import { SignJWT, jwtVerify, JWTPayload, errors } from 'jose';

const rawSecret = process.env.JWT_SECRET;

// Fail-closed: refuse to run without a configured secret. A hardcoded
// fallback would let anyone who knows the default forge valid tokens.
if (!rawSecret) {
    throw new Error('[AUTH] FATAL: JWT_SECRET environment variable is not configured. Refusing to sign/verify tokens with an insecure default.');
}
const key = new TextEncoder().encode(rawSecret);

// ─── Token Expiry Constants ──────────────────────────────────────────────────
export const ACCESS_TOKEN_EXPIRY = '15m';   // Short-lived access token
export const REFRESH_TOKEN_EXPIRY = '7d';    // Long-lived refresh token

// ─── Legacy-compatible sign (defaults to access token expiry) ────────────────
export async function signJWT(payload: Record<string, unknown>, expiresIn: string = ACCESS_TOKEN_EXPIRY): Promise<string> {
    return await new SignJWT(payload)
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime(expiresIn)
        .sign(key);
}

// ─── Access Token (short-lived, carries user claims) ─────────────────────────
export async function signAccessToken(payload: Record<string, unknown>): Promise<string> {
    return await new SignJWT(payload)
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime(ACCESS_TOKEN_EXPIRY)
        .sign(key);
}

// ─── Refresh Token (long-lived, carries claims needed for middleware auth) ────
// Includes role/tokenVersion so middleware can rebuild access token claims
// without a DB lookup (Edge runtime incompatible with Prisma).
// The apiHandler session-validator still does the DB check on every API call.
export async function signRefreshToken(payload: { userId: string; role: string; tokenVersion: number; contractorId?: string }): Promise<string> {
    return await new SignJWT({ ...payload, type: 'refresh' })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime(REFRESH_TOKEN_EXPIRY)
        .sign(key);
}

// ─── Verify Refresh Token ────────────────────────────────────────────────────
export async function verifyRefreshToken(token: string): Promise<JWTPayload | null> {
    try {
        const { payload } = await jwtVerify(token, key, { algorithms: ['HS256'] });
        if (payload.type !== 'refresh') return null;
        return payload;
    } catch {
        return null;
    }
}

// ─── Verify JWT with expiry introspection ────────────────────────────────────
// Returns { valid: true, payload } for valid tokens
// Returns { valid: false, expired: true } for expired tokens (so callers can attempt refresh)
// Returns { valid: false, expired: false } for invalid/tampered tokens
export type VerifyResult =
    | { valid: true; payload: JWTPayload }
    | { valid: false; expired: true; payload?: undefined }
    | { valid: false; expired: false; payload?: undefined };

export async function verifyJWTWithResult(token: string): Promise<VerifyResult> {
    try {
        if (!token) return { valid: false, expired: false };
        const { payload } = await jwtVerify(token, key, { algorithms: ['HS256'] });
        return { valid: true, payload };
    } catch (error: unknown) {
        if (error instanceof errors.JWTExpired) {
            return { valid: false, expired: true };
        }
        return { valid: false, expired: false };
    }
}

// ─── Legacy verify (returns null for any failure) ────────────────────────────
export async function verifyJWT(token: string): Promise<JWTPayload | null> {
    try {
        if (!token) return null;

        const { payload } = await jwtVerify(token, key, {
            algorithms: ['HS256'],
        });
        return payload;
    } catch (error: unknown) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error('[AUTH] Token verification failed:', errorMsg);
        return null;
    }
}
