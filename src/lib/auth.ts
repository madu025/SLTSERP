import { SignJWT, jwtVerify, JWTPayload } from 'jose';

const rawSecret = process.env.JWT_SECRET;

// Fail-closed: refuse to run without a configured secret. A hardcoded
// fallback would let anyone who knows the default forge valid tokens.
if (!rawSecret) {
    throw new Error('[AUTH] FATAL: JWT_SECRET environment variable is not configured. Refusing to sign/verify tokens with an insecure default.');
}
const key = new TextEncoder().encode(rawSecret);

export async function signJWT(payload: Record<string, unknown>, expiresIn: string = '24h'): Promise<string> {
    return await new SignJWT(payload)
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime(expiresIn)
        .sign(key);
}

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
