import { TelemetryService } from '@/services/helpdesk/telemetry.service';
import { apiHandler } from '@/lib/api-handler';
import { validateAgentAuth, rateLimit, getClientIp } from '@/lib/agent-auth';
import { verifyJWT } from '@/lib/auth';
import { validateSession } from '@/lib/session-validator';
import { ROLE_GROUPS, hasRole } from '@/config/roles';
import { NextResponse } from 'next/server';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const TelemetrySchema = z.object({
    serialNumber: z.string(),
    macAddress: z.string(),
    ipAddress: z.string(),
    osVersion: z.string(),
    loggedInUser: z.string(),
});

/**
 * Secured the same way as the sibling /api/assets/sync agent endpoint:
 * validateAgentAuth (static AGENT_API_KEY with fail-closed fallback removal,
 * or short-lived agent Bearer JWT) plus per-IP rate limiting.
 * Anonymous access is rejected with 401.
 */
async function guardAgent(req: Request): Promise<Response | null> {
    const auth = await validateAgentAuth(req);
    if (!auth.success) {
        return auth.errorResponse ?? NextResponse.json(
            { success: false, message: 'Invalid credentials' },
            { status: 401 }
        );
    }

    const ip = getClientIp(req);
    const isAllowed = await rateLimit(ip, 60, 60);
    if (!isAllowed) {
        return NextResponse.json(
            { success: false, message: 'Too many requests. Please try again later.' },
            { status: 429 }
        );
    }

    return null;
}

/**
 * Roles allowed to READ the telemetry feed from the browser dashboard.
 * Mirrors the telemetry page's RoleGuard (PROJECT_MANAGERS) plus the
 * sidebar's IT Helpdesk viewers (OFFICE_ADMINS + ENGINEER).
 */
const TELEMETRY_READ_ROLES = Array.from(
    new Set([...ROLE_GROUPS.PROJECT_MANAGERS, ...ROLE_GROUPS.OFFICE_ADMINS])
);

/**
 * Session-cookie fallback for browser callers. This route is in middleware
 * publicPaths (so agents can POST without JWTs), which means x-user-id is
 * never injected — verify the token cookie directly, with fail-closed
 * tokenVersion freshness (role/status change invalidates it immediately).
 * Read-only GET access; POST ingestion stays agent-key-only.
 */
async function hasSessionReadAccess(req: Request): Promise<boolean> {
    const cookieHeader = req.headers.get('cookie');
    if (!cookieHeader) return false;
    const tokenCookie = cookieHeader
        .split(';')
        .map((c) => c.trim())
        .find((c) => c.startsWith('token='));
    if (!tokenCookie) return false;

    const payload = await verifyJWT(tokenCookie.slice('token='.length));
    if (!payload) return false;

    const uid = (payload.userId || payload.id || payload.sub) as string | undefined;
    if (!uid) return false;

    const session = await validateSession(uid, (payload.tokenVersion as number | undefined) ?? null);
    if (!session.valid) return false;

    return hasRole(session.role ?? (payload.role as string | undefined), TELEMETRY_READ_ROLES);
}

export const GET = apiHandler(async (req) => {
    // Browser session users get read access via their token cookie;
    // anonymous callers must still pass agent auth.
    if (!(await hasSessionReadAccess(req))) {
        const denied = await guardAgent(req);
        if (denied) return denied;
    }

    // rawResponse skips the { success, data } envelope, so wrap manually —
    // the telemetry dashboard page expects json.success + json.data.devices.
    return NextResponse.json({ success: true, data: await TelemetryService.getRegisteredDevices() });
}, { rawResponse: true });

export const POST = apiHandler(async (req, _params, body) => {
    const denied = await guardAgent(req);
    if (denied) return denied;

    const data = TelemetrySchema.parse(body);

    await TelemetryService.ingestTelemetry(data);

    return { success: true, timestamp: Date.now() };
}, { rawResponse: true });
