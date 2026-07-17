import { apiHandler } from '@/lib/api-handler';
import { rateLimit, getClientIp } from '@/lib/agent-auth';
import { AgentSyncService } from '@/services/agent-sync.service';
import { z } from 'zod';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const LoginSchema = z.object({
    apiKey: z.string().min(1, 'API key is required')
});

export const POST = apiHandler(async (req, _params, body) => {
    const ip = getClientIp(req);
    
    // 1. Rate Limit Check (10 requests per minute)
    const isAllowed = await rateLimit(ip, 10, 60);
    if (!isAllowed) {
        return NextResponse.json(
            { success: false, message: 'Too many requests. Please try again later.' },
            { status: 429 }
        );
    }
    
    const { apiKey } = body;
    const result = await AgentSyncService.authenticateAgent(apiKey);
    
    if (!result) {
        console.warn(`[AGENT_LOGIN_FAILED] Invalid API key attempt from IP: ${ip}`);
        return NextResponse.json(
            { success: false, message: 'Invalid credentials' },
            { status: 401 }
        );
    }
    
    return result;
}, {
    schema: LoginSchema,
    rawResponse: true
});
