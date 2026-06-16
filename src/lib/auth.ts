import { SignJWT, jwtVerify } from 'jose';

const SECRET_KEY = process.env.JWT_SECRET || 'dev-secret-key-please-change-in-prod';
const key = new TextEncoder().encode(SECRET_KEY);

export async function signJWT(payload: any, expiresIn: string = '24h') {
    return await new SignJWT(payload)
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime(expiresIn)
        .sign(key);
}

export async function verifyJWT(token: string) {
    try {
        if (!token) return null;

        const { payload } = await jwtVerify(token, key, {
            algorithms: ['HS256'],
        });
        return payload;
    } catch (error: any) {
        console.error('[AUTH] Token verification failed:', error.message);
        return null;
    }
}
