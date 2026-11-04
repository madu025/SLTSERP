import { NextRequest, NextResponse } from 'next/server';
import { getAppBaseUrl } from '@/lib/app-url';

export const dynamic = 'force-dynamic';

/**
 * Download route for Desktop Agent.
 * Serves as the canonical entry point (e.g. /api/agent/download).
 * Redirects seamlessly to the setup package.
 */
export async function GET(request: NextRequest) {
    const defaultUrl = process.env.AGENT_DOWNLOAD_URL || 'http://172.255.209.243:8091/agent/SLTSERPagent_setup.zip';
    
    // Construct target URL dynamically based on incoming request origin/host
    const origin = request.nextUrl.origin || getAppBaseUrl();
    const redirectTarget = defaultUrl.startsWith('http') ? defaultUrl : new URL(defaultUrl, origin).toString();

    return NextResponse.redirect(redirectTarget, {
        status: 302,
        headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Content-Disposition': 'attachment; filename="SLTSERPagent_setup.zip"',
        }
    });
}
