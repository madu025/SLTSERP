import { prisma } from '@/lib/prisma';

/** After this many failures in a row the account is marked as locked in the report (enforcement stays with the Redis rate limit). */
export const FAILED_LOGIN_LOCK_THRESHOLD = 5;
export const LOCK_MINUTES = 15;

export type LoginFailureReason = 'UNKNOWN_USER' | 'INACTIVE' | 'BAD_PASSWORD' | 'OTHER';

/**
 * Sign-in history for access reviews: when each user last signed in, how often attempts failed, from where.
 * Recording is best effort and never changes the outcome of a login.
 */
export class LoginHistoryService {
    static async recordSuccess(userId: string, username: string, ip?: string | null, userAgent?: string | null): Promise<void> {
        try {
            await prisma.$transaction([
                prisma.loginEvent.create({ data: { userId, username, success: true, ipAddress: ip ?? null, userAgent: userAgent ?? null } }),
                prisma.user.update({ where: { id: userId }, data: { lastLoginAt: new Date(), failedLoginCount: 0, lockedUntil: null } }),
            ]);
        } catch (error) {
            console.warn('[LOGIN-HISTORY] success not recorded:', error instanceof Error ? error.message : error);
        }
    }

    static async recordFailure(username: string, reason: LoginFailureReason, ip?: string | null, userAgent?: string | null): Promise<void> {
        try {
            const clean = username.replace(/\0/g, '').trim().slice(0, 120);
            const user = clean ? await prisma.user.findFirst({ where: { username: { equals: clean, mode: 'insensitive' } }, select: { id: true, failedLoginCount: true } }) : null;
            await prisma.loginEvent.create({ data: { userId: user?.id ?? null, username: clean || '(blank)', success: false, reason, ipAddress: ip ?? null, userAgent: userAgent ?? null } });
            if (user) {
                const count = user.failedLoginCount + 1;
                await prisma.user.update({
                    where: { id: user.id },
                    data: { failedLoginCount: count, ...(count >= FAILED_LOGIN_LOCK_THRESHOLD ? { lockedUntil: new Date(Date.now() + LOCK_MINUTES * 60_000) } : {}) },
                });
            }
        } catch (error) {
            console.warn('[LOGIN-HISTORY] failure not recorded:', error instanceof Error ? error.message : error);
        }
    }
}
