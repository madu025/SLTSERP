import { apiHandler } from '@/lib/api-handler';
import { ServiceOrderService } from '@/services/sod.service';
import { bridgeSyncSchema } from '@/lib/validations/service-order.schema';
import { z } from 'zod';
import { AppError } from '@/lib/error';
import { redis } from '@/lib/redis';

export async function OPTIONS() {
    return new Response(null, {
        status: 204,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, x-user-id, x-user-role',
        },
    });
}

export const GET = apiHandler(async (request: Request) => {
    const { searchParams } = new URL(request.url);
    const soNum = searchParams.get('soNum');

    if (!soNum) {
        throw AppError.badRequest('soNum is required');
    }

    const rawData = await ServiceOrderService.getExtensionRawData(soNum);

    if (!rawData) {
        return { success: false, message: 'No bridge data found' };
    }

    const scraped = rawData.scrapedData as Record<string, unknown>;
    return {
        success: true,
        materialDetails: scraped?.materialDetails || [],
        forensicAudit: scraped?.forensicAudit || [],
        lastSynced: rawData.updatedAt
    };
});

export const POST = apiHandler(async (_req, _params, payload: z.infer<typeof bridgeSyncSchema>) => {
    const soNum = payload.soNum;
    if (!soNum) {
        throw AppError.badRequest('Service Order Number is required for sync.');
    }

    const lockKey = `lock:bridge-sync:${soNum}`;
    let acquired = false;
    try {
        const lockAcquired = await redis.set(lockKey, 'locked', 'PX', 10000, 'NX');
        acquired = !!lockAcquired;
        if (!acquired) {
            throw AppError.conflict('CONCURRENT_SYNC_PREVENTED: This service order is currently being updated by another active session.');
        }
    } catch (redisErr) {
        console.warn('[BRIDGE-SYNC] Redis unavailable, bypassing lock:', redisErr);
    }

    try {
        return await ServiceOrderService.bridgeSync(payload);
    } finally {
        if (acquired) {
            try {
                await redis.del(lockKey);
            } catch (redisErr) {
                console.warn('[BRIDGE-SYNC] Redis unavailable, failed to release lock:', redisErr);
            }
        }
    }
}, { 
    schema: bridgeSyncSchema,
    audit: { action: 'BRIDGE_SYNC', entity: 'ServiceOrder' }
});
