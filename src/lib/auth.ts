import { SignJWT, jwtVerify, JWTPayload } from 'jose';

const isProduction = process.env.NODE_ENV === 'production';
const rawSecret = process.env.JWT_SECRET;

if (isProduction && (!rawSecret || rawSecret === 'dev-secret-key-please-change-in-prod')) {
    throw new Error('[FATAL SECURITY CONFIG] JWT_SECRET must be set to a strong secret in production.');
}

const SECRET_KEY = rawSecret || 'dev-secret-key-please-change-in-prod';
const key = new TextEncoder().encode(SECRET_KEY);

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
