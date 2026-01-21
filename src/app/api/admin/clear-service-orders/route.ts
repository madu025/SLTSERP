import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyJWT } from '@/lib/auth';
import { cookies } from 'next/headers';

/**
 * POST /api/admin/clear-service-orders
 * Clear all ServiceOrder data (Admin/Super Admin only)
 */
export async function POST() {
    try {
        // Get token from cookies
        const cookieStore = cookies();
        const token = cookieStore.get('token')?.value;

        if (!token) {
            return NextResponse.json(
                { error: 'Unauthorized. Please login.' },
                { status: 401 }
            );
        }

        // Verify token
        const payload = await verifyJWT(token);
        if (!payload || !payload.role) {
            return NextResponse.json(
                { error: 'Invalid token.' },
                { status: 401 }
            );
        }

        // Authorization check
        if (!['SUPER_ADMIN', 'ADMIN'].includes(payload.role as string)) {
            return NextResponse.json(
                { error: 'Unauthorized. Admin access required.' },
                { status: 403 }
            );
        }

        console.log(`[CLEAR-SOD] Initiated by: ${payload.email}`);

        // Clear all ServiceOrder related data in correct order
        const results = {
            statusHistory: 0,
            materialUsage: 0,
            restoreRequests: 0,
            serviceOrders: 0,
            dashboardStats: 0,
            patStatus: 0,
        };

        // Step 1: Clear child records
        console.log('[CLEAR-SOD] Step 1: Clearing ServiceOrderStatusHistory...');
        const historyResult = await prisma.serviceOrderStatusHistory.deleteMany();
        results.statusHistory = historyResult.count;

        console.log('[CLEAR-SOD] Step 2: Clearing SODMaterialUsage...');
        const materialResult = await prisma.sODMaterialUsage.deleteMany();
        results.materialUsage = materialResult.count;

        console.log('[CLEAR-SOD] Step 3: Clearing RestoreRequests...');
        const restoreResult = await prisma.restoreRequest.deleteMany();
        results.restoreRequests = restoreResult.count;

        // Step 2: Clear main ServiceOrder table
        console.log('[CLEAR-SOD] Step 4: Clearing ServiceOrders...');
        const serviceOrderResult = await prisma.serviceOrder.deleteMany();
        results.serviceOrders = serviceOrderResult.count;

        // Step 3: Clear cache tables
        console.log('[CLEAR-SOD] Step 5: Clearing DashboardStats...');
        const statsResult = await prisma.dashboardStat.deleteMany();
        results.dashboardStats = statsResult.count;

        console.log('[CLEAR-SOD] Step 6: Clearing SLTPATStatus...');
        const patResult = await prisma.sLTPATStatus.deleteMany();
        results.patStatus = patResult.count;

        console.log('[CLEAR-SOD] ✅ All data cleared successfully:', results);

        return NextResponse.json({
            success: true,
            message: 'All Service Order data cleared successfully',
            results
        });

    } catch (error) {
        console.error('[CLEAR-SOD] Error:', error);
        return NextResponse.json(
            { error: 'Failed to clear Service Order data', details: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        );
    }
}
