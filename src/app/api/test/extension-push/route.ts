import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyJWT } from '@/lib/auth';
import { cookies } from 'next/headers';
import { redis } from '@/lib/redis';

async function checkAdminAuth() {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get('token')?.value;
        if (!token) return false;
        const verified = await verifyJWT(token);
        return !!verified && (verified.role === 'ADMIN' || verified.role === 'SUPER_ADMIN');
    } catch {
        return false;
    }
}

export async function OPTIONS() {
    return new NextResponse(null, {
        status: 204,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, x-user-id, x-user-role, x-extension-key',
        },
    });
}

export async function POST(request: Request) {
    try {
        const authHeader = request.headers.get('x-extension-key');
        const extensionSecret = process.env.EXTENSION_SECRET || 'slt-bridge-secret-2026';
        
        let isAuthorized = false;
        if (authHeader === extensionSecret) {
            isAuthorized = true;
        } else {
            isAuthorized = await checkAdminAuth();
        }

        if (!isAuthorized) {
            return NextResponse.json(
                { success: false, error: 'Unauthorized: Missing or invalid credentials' },
                { status: 401, headers: { 'Access-Control-Allow-Origin': '*' } }
            );
        }

        const body = await request.json();
        const soNum = body.soNum;

        // Sanitize Materials (Replace GRID_MATERIAL dummy names with actual Types for UI/DB)
        if (Array.isArray(body.materialDetails)) {
            body.materialDetails = body.materialDetails.map((mat: any) => {
                if (mat.ITEM === 'GRID_MATERIAL' || mat.ITEM === 'TABLE_MAT') {
                    return { ...mat, ITEM: mat.TYPE || mat.ITEM, NAME: mat.TYPE || mat.NAME };
                }
                return mat;
            });
        }

        // Ignore IMAGES tab as requested
        if (body.activeTab === 'IMAGES' || body.activeTab === 'PHOTOS') {
            return NextResponse.json({ success: true, message: 'Images tab ignored' }, {
                headers: { 'Access-Control-Allow-Origin': '*' }
            });
        }

        let acquired = false;
        const lockKey = `lock:bridge-sync:${soNum}`;
        if (soNum) {
            try {
                const lockAcquired = await redis.set(lockKey, 'locked', 'PX', 10000, 'NX');
                acquired = !!lockAcquired;
                if (!acquired) {
                    return NextResponse.json(
                        { success: false, error: 'CONCURRENT_SYNC_PREVENTED: This service order is currently being updated by another active session.' },
                        { status: 409, headers: { 'Access-Control-Allow-Origin': '*' } }
                    );
                }
            } catch (redisErr) {
                console.warn('[EXTENSION-PUSH] Redis unavailable, bypassing lock:', redisErr);
            }
        }

        try {
            let log;
            if (soNum) {
                // Try to find existing row for this SO
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const existing = await (prisma as any).extensionRawData.findFirst({
                    where: { soNum: soNum }
                });

                if (existing) {
                    // Update existing row
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    log = await (prisma as any).extensionRawData.update({
                        where: { id: existing.id },
                        data: {
                            sltUser: body.currentUser || null,
                            activeTab: body.activeTab || null,
                            url: body.url || null,
                            scrapedData: body,
                        }
                    });
                } else {
                    // Create new row
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    log = await (prisma as any).extensionRawData.create({
                        data: {
                            soNum: soNum,
                            sltUser: body.currentUser || null,
                            activeTab: body.activeTab || null,
                            url: body.url || null,
                            scrapedData: body,
                        }
                    });
                }

                // Automatically sync to ServiceOrder model if it has soNum
                try {
                    const { ServiceOrderService } = await import('@/services/sod.service');
                    await ServiceOrderService.bridgeSync(body);
                } catch (syncErr) {
                    console.error('[EXTENSION-PUSH] Failed to trigger bridgeSync for ServiceOrder:', syncErr);
                }
            } else {
                // No soNum, just create (should not happen often with updated addon)
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                log = await (prisma as any).extensionRawData.create({
                    data: {
                        soNum: null,
                        sltUser: body.currentUser || null,
                        activeTab: body.activeTab || null,
                        url: body.url || null,
                        scrapedData: body,
                    }
                });
            }

            console.log(`[EXTENSION-PUSH] Updated data for SO: ${soNum}`);

            return NextResponse.json({
                success: true,
                message: 'Data logged/updated successfully',
                id: log.id
            }, {
                headers: {
                    'Access-Control-Allow-Origin': '*',
                }
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

    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error('[EXTENSION-PUSH] Error logging data:', error);
        return NextResponse.json(
            { success: false, error: errorMessage },
            { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } }
        );
    }
}

export async function GET() {
    try {
        if (!await checkAdminAuth()) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const logs = await (prisma as any).extensionRawData.findMany({
            orderBy: { updatedAt: 'desc' }, // Show most recently updated first
            take: 100
        });

        return NextResponse.json({ success: true, logs });
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json(
            { success: false, error: errorMessage },
            { status: 500 }
        );
    }
}

export async function DELETE() {
    try {
        if (!await checkAdminAuth()) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (prisma as any).extensionRawData.deleteMany({});
        return NextResponse.json({ success: true, message: 'All logs cleared' });
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json(
            { success: false, error: errorMessage },
            { status: 500 }
        );
    }
}
