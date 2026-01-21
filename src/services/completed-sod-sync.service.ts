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

        const errors: string[] = [];
        let completedCount = 0;
        let checkedCount = 0;

        try {
            // Get all OPMCs with RTOM
            const opmcs = await prisma.oPMC.findMany({
                select: { id: true, name: true, rtom: true }
            });

            for (const opmc of opmcs) {
                try {
                    console.log(`[COMPLETED-SOD-SYNC] Checking OPMC: ${opmc.name} (${opmc.rtom})`);

                    // 1. First Sync Pending SODs (ensure they exist in our DB)
                    try {
                        await ServiceOrderService.syncServiceOrders(opmc.id, opmc.rtom);
                    } catch (err) {
                        console.error(`[COMPLETED-SOD-SYNC] Pending sync failed for ${opmc.rtom}:`, err);
                        // Continue anyway, maybe the completed sync will find it
                    }

                    // 2. Fetch Completed SODs from dynamic_load (Direct method)
                    // Format: rtom_startDate_endDate_COMPLETED_SLTS
                    const completedResults = await sltApiService.fetchCompletedSODs(opmc.rtom, startDate, endDate);
                    checkedCount += completedResults.length;

                    console.log(`[COMPLETED-SOD-SYNC] Found ${completedResults.length} completed records in SLT for ${opmc.rtom}`);

                    // Process each completed SOD record
                    for (const sltData of completedResults) {
                        try {
                            // Find matching active SOD in our database
                            // We look for ANY record with this soNum that is not yet completed
                            let localSOD = await prisma.serviceOrder.findFirst({
                                where: {
                                    soNum: sltData.SO_NUM,
                                    sltsStatus: { not: 'COMPLETED' }
                                },
                                select: { id: true }
                            });

                            // Parse drop wire distance as float if it's a number string
                            const distanceStr = sltData.FTTH_INST_SIET?.replace(/[^0-9.]/g, '');
                            const dropWireDistance = distanceStr ? parseFloat(distanceStr) : undefined;
                            const completedDate = sltApiService.parseStatusDate(sltData.CON_STATUS_DATE) || new Date();

                            let alreadyCompleted = null; // Initialize for notification logic

                            if (localSOD) {
                                // Update existing record
                                await ServiceOrderService.patchServiceOrder(
                                    localSOD.id,
                                    {
                                        status: sltData.CON_STATUS,
                                        sltsStatus: 'COMPLETED',
                                        sltsPatStatus: sltData.CON_STATUS,
                                        completedDate: completedDate,
                                        dpDetails: sltData.DP,
                                        ontSerialNumber: sltData.CON_WORO_SEIT || undefined,
                                        iptvSerialNumbers: sltData.IPTV || undefined,
                                        dropWireDistance: dropWireDistance,
                                        comments: `Auto-completed via SLT List (${sltData.CON_STATUS})`,
                                    },
                                    'SYSTEM_AUTO_SYNC'
                                );
                                completedCount++;
                                console.log(`[COMPLETED-SOD-SYNC] ✅ Updated: ${sltData.SO_NUM}`);
                            } else {
                                // If not found, check if it ALREADY exists as completed
                                alreadyCompleted = await prisma.serviceOrder.findFirst({
                                    where: { soNum: sltData.SO_NUM, sltsStatus: 'COMPLETED' },
                                    select: { id: true }
                                });

                                if (!alreadyCompleted) {
                                    // Create a new record (this SOD was completed without us ever seeing it as pending)
                                    await prisma.serviceOrder.create({
                                        data: {
                                            opmcId: opmc.id,
                                            rtom: opmc.rtom,
                                            lea: sltData.LEA,
                                            soNum: sltData.SO_NUM,
                                            voiceNumber: sltData.VOICENUMBER,
                                            orderType: sltData.ORDER_TYPE,
                                            serviceType: sltData.S_TYPE,
                                            customerName: sltData.CON_CUS_NAME,
                                            techContact: sltData.CON_TEC_CONTACT,
                                            status: sltData.CON_STATUS,
                                            sltsStatus: 'COMPLETED',
                                            sltsPatStatus: sltData.CON_STATUS,
                                            completedDate: completedDate,
                                            address: sltData.ADDRE,
                                            dp: sltData.DP,
                                            package: sltData.PKG,
                                            woroTaskName: sltData.CON_WORO_TASK_NAME,
                                            iptv: sltData.IPTV,
                                            woroSeit: sltData.CON_WORO_SEIT,
                                            dpDetails: sltData.DP,
                                            ontSerialNumber: sltData.CON_WORO_SEIT || undefined,
                                            iptvSerialNumbers: sltData.IPTV || undefined,
                                            dropWireDistance: dropWireDistance,
                                            comments: `Created directly as COMPLETED from SLT List`,
                                            sales: sltData.CON_SALES
                                        }
                                    });
                                    completedCount++;
                                    console.log(`[COMPLETED-SOD-SYNC] ✨ Created and Completed: ${sltData.SO_NUM}`);
                                }
                            }

                            // Notification for newly completed items
                            if (!alreadyCompleted || localSOD) {
                                // Send notification
                                await NotificationService.notifyByRole({
                                    roles: ['OSP_MANAGER', 'OFFICE_ADMIN', 'ADMIN'],
                                    title: 'SOD Completed (Sync)',
                                    message: `SOD ${sltData.SO_NUM} has been marked as completed.`,
                                    type: 'PROJECT',
                                    priority: 'LOW', // Reduced priority for mass syncs
                                    link: `/service-orders/completed`
                                });
                            }

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
