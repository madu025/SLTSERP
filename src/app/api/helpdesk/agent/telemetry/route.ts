import { TelemetryService } from '@/services/helpdesk/telemetry.service';
import { apiHandler } from '@/lib/api-handler';
import { validateAgentAuth, rateLimit, getClientIp } from '@/lib/agent-auth';
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

export const GET = apiHandler(async (req) => {
    const denied = await guardAgent(req);
    if (denied) return denied;

    return await TelemetryService.getRegisteredDevices();
}, { rawResponse: true });

export const POST = apiHandler(async (req, _params, body) => {
    const denied = await guardAgent(req);
    if (denied) return denied;

    const data = TelemetrySchema.parse(body);

    await TelemetryService.ingestTelemetry(data);

    return { success: true, timestamp: Date.now() };
}, { rawResponse: true });
