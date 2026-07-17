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

    // 2. Resolve Host & Protocol for download URL (must match the request host to satisfy "same domain" constraint)
    const host = req.headers.get('host') || 'sltserp.vercel.app';
    const protocol = req.headers.get('x-forwarded-proto') || 'https';
    const downloadUrl = `${protocol}://${host}/downloads/SLTSERPagent.exe`;

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
            console.warn(`[AUTO-UPDATER] Executable file not found at ${exePath}. Using dummy hash for testing.`);
            // A fallback dummy sha256 hash (SHA-256 of empty file)
            sha256 = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
        }
    } catch (err: any) {
        console.error('[AUTO-UPDATER] Failed to read agent executable hash:', err);
        sha256 = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
    }

    return {
        latestVersion: '1.0.1',
        downloadUrl,
        sha256,
        mandatory: true
    };
}, {
    rawResponse: true
});
