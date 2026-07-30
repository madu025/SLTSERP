export const dynamic = 'force-dynamic';

import { apiHandler } from '@/lib/api-handler';
import { ServiceOrderService } from '@/services/sod/sod.service';
import { AppError } from '@/lib/error';
import { redis } from '@/lib/redis';
import { verifyJWT } from '@/lib/auth';
import { cookies } from 'next/headers';
import { ROLE_GROUPS } from '@/config/roles';

async function checkAdminAuth() {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get('token')?.value;
        if (!token) return false;
        const verified = await verifyJWT(token);
        return !!verified && (ROLE_GROUPS.ADMINS as readonly string[]).includes(String(verified.role));
    } catch {
        return false;
    }
}

export async function OPTIONS() {
    return new Response(null, {
        status: 204,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, x-user-id, x-user-role, x-extension-key',
        },
    });
}

export const POST = apiHandler(async (req, _params, body) => {
    const authHeader = req.headers.get('x-extension-key');
    const extensionSecret = process.env.EXTENSION_SECRET || 'slt-bridge-secret-2026';
    
    let isAuthorized = false;
    if (authHeader === extensionSecret) {
        isAuthorized = true;
    } else {
        isAuthorized = await checkAdminAuth();
    }

    if (!isAuthorized) {
        return Response.json(
            { success: false, error: 'Unauthorized: Missing or invalid credentials' },
            { status: 401, headers: { 'Access-Control-Allow-Origin': '*' } }
        );
    }

    const soNum = (body.soNum as string | undefined) ?? null;

    // Sanitize Materials (Replace GRID_MATERIAL dummy names with actual Types for UI/DB)
    if (Array.isArray(body.materialDetails)) {
        body.materialDetails = body.materialDetails.map((mat: Record<string, string | undefined>) => {
            if (mat.ITEM === 'GRID_MATERIAL' || mat.ITEM === 'TABLE_MAT') {
                return { ...mat, ITEM: mat.TYPE || mat.ITEM, NAME: mat.TYPE || mat.NAME };
            }
            return mat;
        });
    }

    // Ignore IMAGES tab as requested
    if (body.activeTab === 'IMAGES' || body.activeTab === 'PHOTOS') {
        return Response.json({ success: true, message: 'Images tab ignored' }, {
            headers: { 'Access-Control-Allow-Origin': '*' }
        });
    }

    let acquired = false;
    const lockKey = `lock:bridge-sync:${soNum}`;
    if (soNum) {
        try {
            if (redis.status === 'ready') {
                const lockAcquired = await redis.set(lockKey, 'locked', 'PX', 10000, 'NX');
                acquired = !!lockAcquired;
                if (!acquired) {
                    return Response.json(
                        { success: false, error: 'CONCURRENT_SYNC_PREVENTED: This service order is currently being updated by another active session.' },
                        { status: 409, headers: { 'Access-Control-Allow-Origin': '*' } }
                    );
                }
            } else {
                // Silently bypass lock if Redis is not connected to avoid terminal error spam
                acquired = true; 
            }
        } catch (redisErr: unknown) {
            const msg = redisErr instanceof Error ? redisErr.message : String(redisErr);
            console.warn(`[EXTENSION-PUSH] Redis lock bypass (Status: ${redis.status}):`, msg);
        }
    }

    try {
        const log = await ServiceOrderService.saveExtensionRawData(soNum, body as Record<string, unknown>);

        // Automatically sync to ServiceOrder model if it has soNum
        if (soNum) {
            try {
                await ServiceOrderService.bridgeSync(body);
            } catch (syncErr) {
                console.error('[EXTENSION-PUSH] Failed to trigger bridgeSync for ServiceOrder:', syncErr);
            }
        }

        console.log(`[EXTENSION-PUSH] Updated data for SO: ${soNum}`);

        return Response.json({
            success: true,
            message: 'Data logged/updated successfully',
            id: log.id
        }, {
            headers: { 'Access-Control-Allow-Origin': '*' }
        });
    } finally {
        if (acquired) {
            try {
                await redis.del(lockKey);
            } catch (redisErr) {
                console.warn('[EXTENSION-PUSH] Redis unavailable, failed to release lock:', redisErr);
            }
        }
    }
}, { rawResponse: true });

export const GET = apiHandler(async () => {
    if (!await checkAdminAuth()) {
        throw AppError.unauthorized('Unauthorized');
    }
    const logs = await ServiceOrderService.getExtensionLogs();
    return Response.json({ success: true, logs });
});

export const DELETE = apiHandler(async () => {
    if (!await checkAdminAuth()) {
        throw AppError.unauthorized('Unauthorized');
    }
    await ServiceOrderService.clearExtensionLogs();
    return Response.json({ success: true, message: 'All logs cleared' });
});
