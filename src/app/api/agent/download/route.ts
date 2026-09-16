import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Download route for Desktop Agent.
 * Serves as the canonical entry point on the Vercel domain (sltserp.vercel.app/api/agent/download).
 * Redirects seamlessly to the high-speed S3 storage distribution package.
 */
export async function GET() {
    const s3DownloadUrl = process.env.AGENT_DOWNLOAD_URL || 'https://sltserp-sync.duckdns.org/files/sltserp-agent/SLTSERPagent_setup.zip';
    
    return NextResponse.redirect(s3DownloadUrl, {
        status: 302,
        headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Content-Disposition': 'attachment; filename="SLTSERPagent_setup.zip"',
        }
    });
}
