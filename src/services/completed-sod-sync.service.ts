import { prisma } from '@/lib/prisma';
import { sltApiService } from './slt-api.service';
import { NotificationService } from './notification.service';

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

        const errors: string[] = [];
        let completedCount = 0;
        let checkedCount = 0;

        try {
            // Get all OPMCs
            const opmcs = await prisma.oPMC.findMany({
                select: { id: true, name: true }
            });

            for (const opmc of opmcs) {
                try {
                    console.log(`[COMPLETED-SOD-SYNC] Checking OPMC: ${opmc.name}`);

                    // Fetch PAT success results (this endpoint works!)
                    const patResults = await sltApiService.fetchPATResults(opmc.id);
                    checkedCount += patResults.length;

                    console.log(`[COMPLETED-SOD-SYNC] Found ${patResults.length} PAT success records`);

                    // Process each PAT success record
                    for (const patData of patResults) {
                        try {
                            // Find matching pending SOD
                            const localSOD = await prisma.serviceOrder.findFirst({
                                where: {
                                    soNum: patData.SO_NUM,
                                    status: 'PENDING'
                                }
                            });

                            if (!localSOD) {
                                continue; // Already completed or not found
                            }

                            // Check if PAT status indicates completion
                            const completionStatuses = [
                                'PAT_PASSED',
                                'PAT_SUCCESS',
                                'COMPLETED',
                                'PAT_CORRECTED'
                            ];

                            if (completionStatuses.includes(patData.CON_STATUS)) {
                                // Fetch full SOD details from SLT pending table
                                const sltSODs = await sltApiService.fetchServiceOrders(opmc.id);
                                const sltSOD = sltSODs.find(sod => sod.SO_NUM === patData.SO_NUM);

                                if (!sltSOD) {
                                    console.warn(`[COMPLETED-SOD-SYNC] SOD ${patData.SO_NUM} not found in SLT, completing without stats`);
                                }

                                // Use existing service to maintain consistency
                                const { ServiceOrderService } = await import('./sod.service');

                                await ServiceOrderService.patchServiceOrder(
                                    localSOD.id,
                                    {
                                        status: 'COMPLETED',
                                        sltsStatus: 'COMPLETED',
                                        sltsPatStatus: patData.CON_STATUS,
                                        completedDate: new Date(patData.CON_STATUS_DATE),
                                        // Populate stats from SLT if available
                                        ...(sltSOD && {
                                            dpDetails: sltSOD.DP,
                                            ontSerialNumber: sltSOD.CON_WORO_SEIT || undefined,
                                            iptvSerialNumbers: sltSOD.IPTV || undefined,
                                            dropWireDistance: sltSOD.FTTH_INST_SIET || undefined,
                                        }),
                                        comments: sltSOD
                                            ? `Auto-completed with SLT stats (PAT: ${patData.CON_STATUS})`
                                            : `Auto-completed via PAT ${patData.CON_STATUS} (stats unavailable)`,
                                    },
                                    'SYSTEM_PAT_AUTO_COMPLETE'
                                );

                                completedCount++;

                                // Send notification
                                await NotificationService.notifyByRole({
                                    roles: ['OSP_MANAGER', 'OFFICE_ADMIN', 'ADMIN'],
                                    title: 'SOD Auto-Completed',
                                    message: `SOD ${patData.SO_NUM} completed ${sltSOD ? 'with stats from SLT' : 'without stats'} (PAT: ${patData.CON_STATUS})`,
                                    type: 'PROJECT',
                                    priority: 'MEDIUM',
                                    link: `/service-orders/completed`
                                });

                                console.log(`[COMPLETED-SOD-SYNC] ✅ Completed ${sltSOD ? 'with stats' : 'without stats'}: ${patData.SO_NUM}`);
                            }

                        } catch (error) {
                            const errorMsg = `Failed to process ${patData.SO_NUM}: ${error instanceof Error ? error.message : 'Unknown error'}`;
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
