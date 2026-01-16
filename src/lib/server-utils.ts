import { cookies } from 'next/headers';
import { verifyJWT } from './auth';

export async function getCurrentUser() {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;

    if (!token) return null;

    const payload = await verifyJWT(token);
    if (!payload) return null;

    return {
        id: payload.id as string,
        role: payload.role as string,
        username: payload.username as string,
        name: payload.name as string
    };
}

export async function requireAuth(roles?: string[]) {
    const user = await getCurrentUser();

    if (!user) {
        throw new Error('Authentication required');
    }

    if (roles && !roles.includes('ALL') && !roles.includes(user.role)) {
        throw new Error('Forbidden: Insufficient permissions');
    }

    return user;
}
