import { cookies } from 'next/headers';
import { verifyJWT } from '@/lib/auth';
import { validateSession } from '@/lib/session-validator';
import { AppError } from '@/lib/error';

/**
 * Some routes are listed as public in the middleware so the browser extension can call them with a shared key.
 * The middleware then skips JWT verification, so the route has to resolve the browser session itself.
 */
export function hasValidExtensionKey(req: Request): boolean {
    const secret = process.env.EXTENSION_SECRET;
    return !!secret && req.headers.get('x-extension-key') === secret;
}

export async function getSessionPermissionsFromCookie(): Promise<{ userId: string; permissions: string[] } | null> {
    try {
        const token = (await cookies()).get('token')?.value;
        if (!token) return null;
        const verified = await verifyJWT(token);
        if (!verified) return null;
        const userId = (verified.userId || verified.id || verified.sub) as string | undefined;
        if (!userId) return null;
        const session = await validateSession(userId, (verified.tokenVersion as number | undefined) ?? null);
        if (!session.valid) return null;
        return { userId, permissions: session.permissions ?? [] };
    } catch {
        return null;
    }
}

/** Extension key, or a logged-in session holding at least one of `anyOf`. Anything else is refused. */
export async function requireExtensionOrSession(req: Request, anyOf: string[]) {
    if (hasValidExtensionKey(req)) return { viaExtension: true as const, userId: null, permissions: [] as string[] };
    const session = await getSessionPermissionsFromCookie();
    if (!session) throw AppError.unauthorized('Authentication required');
    if (!anyOf.some((p) => session.permissions.includes(p))) throw AppError.forbidden('Permission Denied');
    return { viaExtension: false as const, ...session };
}
