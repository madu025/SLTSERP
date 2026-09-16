import { apiHandler } from '@/lib/api-handler';
import { validateAgentAuth } from '@/lib/agent-auth';
import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async (req, _params) => {
    // 1. Authenticate Request
    const auth = await validateAgentAuth(req);
    if (!auth.success) {
        return auth.errorResponse!;
    }

    // 2. Resolve Host & Protocol for download URL (Vercel canonical domain entry point)
    const host = req.headers.get('host') || 'sltserp.vercel.app';
    const protocol = req.headers.get('x-forwarded-proto') || 'https';
    const downloadUrl = process.env.AGENT_DOWNLOAD_URL || `${protocol}://${host}/api/agent/download`;

    // 3. Dynamically read the file to calculate its SHA-256
    const exePath = path.join(process.cwd(), 'public', 'downloads', 'SLTSERPagent.exe');
    let sha256 = '';

    try {
        if (fs.existsSync(exePath)) {
            const fileBuffer = fs.readFileSync(exePath);
            const hashSum = crypto.createHash('sha256');
            hashSum.update(fileBuffer);
            sha256 = hashSum.digest('hex').toLowerCase();
        } else {
            console.warn(`[AUTO-UPDATER] Executable file not found at ${exePath}. Using compiled release hash.`);
            // Compiled release v1.0.2 SHA-256 hash
            sha256 = 'c694ad0a204dff0d8d4efb96f4a78f742407956c669e8c45bf78fdc7f27af6c6';
        }
    } catch (err: unknown) {
        console.error('[AUTO-UPDATER] Failed to read agent executable hash:', err);
        sha256 = 'c694ad0a204dff0d8d4efb96f4a78f742407956c669e8c45bf78fdc7f27af6c6';
    }

    return {
        latestVersion: '1.0.2',
        downloadUrl,
        sha256,
        mandatory: true
    };
}, {
    rawResponse: true
});
