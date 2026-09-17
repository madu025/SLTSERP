import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Download route for Desktop Agent.
 * Serves as the canonical entry point on the Vercel domain (sltserp.vercel.app/api/agent/download).
 * Redirects seamlessly to the high-speed S3 storage distribution package.
 */
export async function GET() {
    const defaultUrl = process.env.AGENT_DOWNLOAD_URL || '/downloads/SLTSERPagent_setup.zip';
    
    return NextResponse.redirect(defaultUrl.startsWith('http') ? defaultUrl : new URL(defaultUrl, process.env.NEXT_PUBLIC_APP_URL || 'https://sltserp.vercel.app'), {
        status: 302,
        headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Content-Disposition': 'attachment; filename="SLTSERPagent_setup.zip"',
        }
    });
}
