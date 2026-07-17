import { apiHandler } from '@/lib/api-handler';
import { validateAgentAuth, rateLimit, getClientIp } from '@/lib/agent-auth';
import { AgentSyncService } from '@/services/agent-sync.service';
import { z } from 'zod';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const SyncAssetSchema = z.object({
    computerName: z.string().min(1, 'computerName is required'),
    serialNumber: z.string().min(1, 'serialNumber is required'),
    osVersion: z.string().min(1, 'osVersion is required'),
    employeeUsername: z.string().min(1, 'employeeUsername is required'),
    employeeNumber: z.string().min(1, 'employeeNumber is required'),
    ipAddress: z.string().min(1, 'ipAddress is required'),
    macAddress: z.string().min(1, 'macAddress is required'),
    brand: z.string().optional(),
    model: z.string().optional()
});

export const POST = apiHandler(async (req, _params, body) => {
    // 1. Authenticate Request
    const auth = await validateAgentAuth(req);
    if (!auth.success) {
        return auth.errorResponse!;
    }

    const ip = getClientIp(req);
    
    // 2. Rate Limit Check (60 requests per minute)
    const isAllowed = await rateLimit(ip, 60, 60);
    if (!isAllowed) {
        return NextResponse.json(
            { success: false, message: 'Too many requests. Please try again later.' },
            { status: 429 }
        );
    }

    // 3. Perform Sync Logic
    const result = await AgentSyncService.syncAsset(body, ip);

    if (!result) {
        return NextResponse.json(
            {
                success: false,
                message: 'Asset not registered. Contact IT.',
                requiresRegistration: true
            },
            { status: 404 }
        );
    }

    return result;
}, {
    schema: SyncAssetSchema,
    rawResponse: true
});
