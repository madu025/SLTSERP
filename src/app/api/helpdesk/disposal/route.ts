import { apiHandler } from '@/lib/api-handler';
import { z } from 'zod';
import { DisposalReason } from '@prisma/client';
import { AppError } from '@/lib/error';
import { AssetDisposalService } from '@/services/helpdesk/asset-disposal.service';

export const dynamic = 'force-dynamic';

async function getAuthUserId(req: Request): Promise<string> {
    const userId = req.headers.get('x-user-id');
    if (!userId) {
        throw AppError.unauthorized('Unauthorized access');
    }
    return userId;
}

export const GET = apiHandler(async (req: Request) => {
    const url = new URL(req.url);
    const status = url.searchParams.get('status') || undefined;
    const search = url.searchParams.get('search') || undefined;

    return await AssetDisposalService.getDisposalRequests({ status, search });
}, {
    rawResponse: true
});

export const POST = apiHandler(async (req: Request) => {
    const userId = await getAuthUserId(req);
    const payload = await req.json();

    const schema = z.object({
        assetId: z.string(),
        reason: z.nativeEnum(DisposalReason),
        salvageValue: z.number().optional().default(0)
    });

    const data = schema.parse(payload);
    return await AssetDisposalService.createDisposalRequest(userId, data);
}, {
    rawResponse: true
});

export const PUT = apiHandler(async (req: Request) => {
    const userId = await getAuthUserId(req);
    const payload = await req.json();

    const schema = z.object({
        requestId: z.string(),
        action: z.enum(['APPROVE', 'REJECT'])
    });

    const data = schema.parse(payload);
    return await AssetDisposalService.processDisposalApproval(userId, data);
}, {
    rawResponse: true
});
