import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/admin/system/reset-sods
 * ⚠️ CRITICAL: Clears all Service Order related data to reset the system.
 */
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { confirmText } = body;

        // Force a confirmation string to prevent accidental resets
        if (confirmText !== 'RESET_ALL') {
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

    } catch (error) {
        console.error('[SYSTEM-RESET] Error during reset:', error);
        return NextResponse.json({
            message: 'Failed to reset system data',
            error: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}
