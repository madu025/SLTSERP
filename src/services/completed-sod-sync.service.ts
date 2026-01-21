import { prisma } from '@/lib/prisma';
import { sltApiService } from './slt-api.service';
import { NotificationService } from './notification.service';
import { ServiceOrderService } from './sod.service';
import { format, startOfMonth, endOfMonth } from 'date-fns';

export class CompletedSODSyncService {
    /**
     * Sync completed SODs based on PAT success data
     * This uses the existing PAT success endpoint which works
     */
    static async syncCompletedSODs(): Promise<{
        checked: number;
        completed: number;
        errors: string[];
    }> {
        console.log('[COMPLETED-SOD-SYNC] Starting sync...');

        const today = new Date();
        const startDate = format(startOfMonth(today), 'yyyy-MM-dd');
        const endDate = format(endOfMonth(today), 'yyyy-MM-dd');

        try {
            // Get all OPMCs with RTOM
            const opmcs = await prisma.oPMC.findMany({
                select: { id: true, name: true, rtom: true }
            });

            for (const opmc of opmcs) {
                try {
                    console.log(`[COMPLETED-SOD-SYNC] Checking OPMC: ${opmc.name} (${opmc.rtom})`);

                    // 1. First Sync Pending SODs (ensure they exist in our DB)
                    await ServiceOrderService.syncServiceOrders(opmc.id, opmc.rtom);

                    // 2. Fetch Completed SODs from dynamic_load (Direct method)
                    // Format: rtom_startDate_endDate_COMPLETED_SLTS
                    const completedResults = await sltApiService.fetchCompletedSODs(opmc.rtom, startDate, endDate);
                    checkedCount += completedResults.length;

                    console.log(`[COMPLETED-SOD-SYNC] Found ${completedResults.length} completed records in SLT for ${opmc.rtom}`);

                    // Process each completed SOD record
                    for (const sltData of completedResults) {
                        try {
                            // Find matching pending SOD in our database
                            const localSOD = await prisma.serviceOrder.findFirst({
                                where: {
                                    soNum: sltData.SO_NUM,
                                    status: 'PENDING'
                                },
                                select: { id: true }
                            });

                            if (!localSOD) {
                                continue; // Already completed or not found
                            }

                            // Use existing service to maintain consistency
                            await ServiceOrderService.patchServiceOrder(
                                localSOD.id,
                                {
                                    status: 'COMPLETED',
                                    sltsStatus: 'COMPLETED',
                                    sltsPatStatus: sltData.CON_STATUS,
                                    completedDate: sltApiService.parseStatusDate(sltData.CON_STATUS_DATE) || new Date(),
                                    // Populate stats from SLT
                                    dpDetails: sltData.DP,
                                    ontSerialNumber: sltData.CON_WORO_SEIT || undefined,
                                    iptvSerialNumbers: sltData.IPTV || undefined,
                                    dropWireDistance: sltData.FTTH_INST_SIET || undefined,
                                    comments: `Auto-completed via SLT List (${sltData.CON_STATUS})`,
                                },
                                'SYSTEM_AUTO_SYNC'
                            );

                            completedCount++;

                            // Send notification
                            await NotificationService.notifyByRole({
                                roles: ['OSP_MANAGER', 'OFFICE_ADMIN', 'ADMIN'],
                                title: 'SOD Completed (Auto-Sync)',
                                message: `SOD ${sltData.SO_NUM} has been marked as completed from SLT data.`,
                                type: 'PROJECT',
                                priority: 'MEDIUM',
                                link: `/service-orders/completed`
                            });

                            console.log(`[COMPLETED-SOD-SYNC] ✅ Synced Completed: ${sltData.SO_NUM}`);

                        } catch (error) {
                            const errorMsg = `Failed to process ${sltData.SO_NUM}: ${error instanceof Error ? error.message : 'Unknown error'}`;
                            errors.push(errorMsg);
                            console.error(`[COMPLETED-SOD-SYNC] ❌ ${errorMsg}`);
                        }
                    }

                } catch (error) {
                    const errorMsg = `Failed to process OPMC ${opmc.name}: ${error instanceof Error ? error.message : 'Unknown error'}`;
                    errors.push(errorMsg);
                    console.error(`[COMPLETED-SOD-SYNC] ❌ ${errorMsg}`);
                }
            }

            console.log(`[COMPLETED-SOD-SYNC] ✅ Completed ${completedCount} SODs from ${checkedCount} PAT records`);

            return {
                checked: checkedCount,
                completed: completedCount,
                errors
            };

        } catch (error) {
            console.error('[COMPLETED-SOD-SYNC] Fatal error:', error);
            return {
                checked: 0,
                completed: 0,
                errors: [error instanceof Error ? error.message : 'Unknown error']
            };
        }
    }

    /**
     * Start periodic sync (every 30 minutes)
     */
    private static intervalId: NodeJS.Timeout | null = null;

    static startPeriodicSync(): void {
        if (this.intervalId) {
            console.log('[COMPLETED-SOD-SYNC] Already running');
            return;
        }

        console.log('[COMPLETED-SOD-SYNC] Starting periodic sync (30-minute intervals)');

        // Run immediately
        this.syncCompletedSODs();

        // Then every 30 minutes
        this.intervalId = setInterval(() => {
            this.syncCompletedSODs();
        }, 30 * 60 * 1000);
    }

    static stopPeriodicSync(): void {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
            console.log('[COMPLETED-SOD-SYNC] Stopped');
        }
    }
}
