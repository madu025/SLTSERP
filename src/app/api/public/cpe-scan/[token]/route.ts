import { NextResponse } from 'next/server';
import { AppError } from '@/lib/error';
import { rateLimit, getClientIp } from '@/lib/agent-auth';
import { CpePhoneScanService } from '@/services/inventory/cpe-phone-scan.service';

export const dynamic = 'force-dynamic';

// The phone side of "Scan with phone". No sign-in: the random token in the QR code is the only key, it lasts 30 minutes and lets the phone
// add serial text to that one session only (the person on the computer still checks and saves). Rate limited per address.
const fail = (e: unknown) => {
    if (e instanceof AppError && (e.statusCode === 404 || e.statusCode === 409)) return NextResponse.json({ error: e.message }, { status: e.statusCode });
    console.error('[CPE_PHONE_SCAN]', e);
    return NextResponse.json({ error: 'Could not reach the scan session' }, { status: 500 });
};

export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
    try {
        if (!(await rateLimit(`cpe-scan:${getClientIp(req)}`, 120, 60))) return NextResponse.json({ error: 'Too many requests; wait a minute' }, { status: 429 });
        const { token } = await params;
        return NextResponse.json({ success: true, data: await CpePhoneScanService.info(token) });
    } catch (e) {
        return fail(e);
    }
}

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
    try {
        if (!(await rateLimit(`cpe-scan:${getClientIp(req)}`, 120, 60))) return NextResponse.json({ error: 'Too many requests; wait a minute' }, { status: 429 });
        const { token } = await params;
        const body = await req.json().catch(() => ({})) as { serials?: unknown };
        return NextResponse.json({ success: true, data: await CpePhoneScanService.add(token, body.serials) });
    } catch (e) {
        return fail(e);
    }
}
