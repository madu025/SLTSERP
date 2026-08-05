import { AppError } from './error';

/**
 * Fail-closed cron authentication — single guard shared by every /api/cron route.
 *
 * World-class convention:
 *  - CRON_SECRET missing from the environment  -> reject (never fail open)
 *  - Caller secret must match exactly (Authorization: Bearer <secret> or ?secret=)
 *
 * The secret itself is environment-driven (docker-compose / .env / CI secrets);
 * nothing is hardcoded here.
 */
export function assertCronAuth(req: Request): void {
    const expected = process.env.CRON_SECRET;
    if (!expected) {
        throw AppError.unauthorized('Cron endpoints are disabled: CRON_SECRET is not configured');
    }

    const { searchParams } = new URL(req.url);
    const supplied =
        req.headers.get('authorization')?.replace('Bearer ', '') ||
        searchParams.get('secret');

    if (supplied !== expected) {
        throw AppError.unauthorized('Unauthorized: Invalid CRON_SECRET');
    }
}
