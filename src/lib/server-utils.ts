import { cookies } from 'next/headers';
import { verifyJWT } from './auth';

/**
 * Recursively convert Prisma results into plain serializable values so they can
 * safely cross the Server Action / RSC boundary. Prisma Decimal (decimal.js)
 * instances are not serializable and trigger "Decimal objects are not supported";
 * they are converted to numbers. Dates stay as Dates (supported natively).
 */
export function toSerializable<T>(value: T): T {
    return sanitizeValue(value) as T;
}

function sanitizeValue(value: unknown): unknown {
    if (value === null || value === undefined) return value;
    if (Array.isArray(value)) return value.map(sanitizeValue);
    if (typeof value === 'bigint') return Number(value);
    if (value instanceof Date) return value;
    if (typeof value === 'object') {
        const record = value as Record<string, unknown>;
        // Prisma Decimal (decimal.js). Use the static isDecimal() guard because the
        // Prisma client bundle minifies the class name ('Decimal' -> 'i'), and use
        // toFixed() over toNumber() to preserve precision for large values.
        const decimalCtor = record.constructor as { isDecimal?: (v: unknown) => boolean } | undefined;
        if (typeof decimalCtor?.isDecimal === 'function' && decimalCtor.isDecimal(record)) {
            return Number((record.toFixed as (dp: number) => string)(6));
        }
        const out: Record<string, unknown> = {};
        for (const key of Object.keys(record)) {
            out[key] = sanitizeValue(record[key]);
        }
        return out;
    }
    return value;
}

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
