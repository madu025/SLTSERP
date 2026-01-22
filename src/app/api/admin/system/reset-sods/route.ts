import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';

/**
 * POST /api/admin/system/reset-sods
 * ⚠️ CRITICAL: Clears all Service Order related data to reset the system.
 */
export async function POST(request: Request) {
    try {
        // 1. Basic Security Check (Check if user is Super Admin)
        const cookieStore = await cookies();
        const token = cookieStore.get('token')?.value;

        if (!token) {
            return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
        }

        // You might need to verify the token and check roles here
        // If your auth is handled via middleware, this is a secondary safety check

        const body = await request.json();
        const { confirmText } = body;

        // Force a confirmation string to prevent accidental resets
        if (confirmText !== 'RESET_ALL_SERVICE_ORDERS') {
            return NextResponse.json({ message: 'Invalid confirmation text' }, { status: 400 });
        }

        console.log('[SYSTEM-RESET] Starting full Service Order data reset...');

        // 2. Perform deletion in a Transaction to ensure consistency
        await prisma.$transaction(async (tx) => {
            // Delete child records first
            await tx.serviceOrderStatusHistory.deleteMany({});
            await tx.sODMaterialUsage.deleteMany({});
            await tx.restoreRequest.deleteMany({});

            // Disconnect or delete Invoices if any
            await tx.serviceOrder.updateMany({
                data: { invoiceId: null }
            });
            await tx.invoice.deleteMany({});

            // Now delete main Service Orders
            await tx.serviceOrder.deleteMany({});

            // Clear SLT API Caches
            await tx.sLTPATStatus.deleteMany({});

            // Reset Dashboard Stats to 0
            await tx.dashboardStat.updateMany({
                data: {
                    pending: 0,
                    completed: 0,
                    returned: 0,
                    patPassed: 0,
                    patRejected: 0,
                    sltsPatRejected: 0
                }
            });

            // Log this massive action in Audit Log
            // Note: We skip Foreign Key check if AuditLog.userId is needed but we don't have it easily here
            console.log('[SYSTEM-RESET] Data cleared successfully.');
        });

        return NextResponse.json({
            message: 'All service order data has been successfully cleared. System is ready for fresh start.',
            timestamp: new Date().toISOString()
        });

    } catch (error: any) {
        console.error('[SYSTEM-RESET] Error during reset:', error);
        return NextResponse.json({
            message: 'Failed to reset system data',
            error: error.message
        }, { status: 500 });
    }
}
