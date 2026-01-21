import { prisma } from '@/lib/prisma';
import { sltApiService } from './slt-api.service';
import { ServiceOrderService } from './sod.service';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';

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
        const lastMonth = subMonths(today, 1);
        const startDate = format(startOfMonth(lastMonth), 'yyyy-MM-dd');
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
                    console.log(`[COMPLETED-SOD-SYNC] [DEBUG] 🔍 Checking OPMC: ${opmc.name} (${opmc.rtom})`);

                    // 1. First Sync Pending SODs
                    try {
                        console.log(`[COMPLETED-SOD-SYNC] [DEBUG] Running pending sync first...`);
                        const pendingStats = await ServiceOrderService.syncServiceOrders(opmc.id, opmc.rtom);
                        console.log(`[COMPLETED-SOD-SYNC] [DEBUG] Pending Sync Results: Created ${pendingStats.created}, Updated ${pendingStats.updated}`);
                    } catch (err) {
                        console.error(`[COMPLETED-SOD-SYNC] [ERROR] Pending sync failed:`, err);
                    }

                    // 2. Fetch Completed SODs
                    const url = `https://serviceportal.slt.lk/iShamp/contr/dynamic_load.php?x=ftth&z=${opmc.rtom}_${startDate}_${endDate}_COMPLETED_SLTS`;
                    console.log(`[COMPLETED-SOD-SYNC] [DEBUG] Fetching completed list from: ${url}`);

                    const completedResults = await sltApiService.fetchCompletedSODs(opmc.rtom, startDate, endDate);
                    checkedCount += completedResults.length;

                    if (completedResults.length > 0) {
                        console.log(`[COMPLETED-SOD-SYNC] [DEBUG] Sample keys from SLT: ${Object.keys(completedResults[0]).join(', ')}`);
                    }

                    console.log(`[COMPLETED-SOD-SYNC] [DEBUG] 📡 Found ${completedResults.length} records in SLT for ${opmc.rtom}`);

                    // Process each completed SOD record
                    for (const sltData of completedResults) {
                        try {
                            // Find matching active SOD (looking for non-completed)
                            const localSODs = await prisma.serviceOrder.findMany({
                                where: {
                                    soNum: sltData.SO_NUM,
                                    sltsStatus: { not: 'COMPLETED' }
                                },
                                select: { id: true, sltsStatus: true, status: true, statusDate: true }
                            });

                            if (localSODs.length > 0) {
                                console.log(`[COMPLETED-SOD-SYNC] [DEBUG] 🎯 Found ${localSODs.length} match(es) in DB for ${sltData.SO_NUM}`);

                                for (const localSOD of localSODs) {
                                    const distanceStr = sltData.FTTH_INST_SIET?.replace(/[^0-9.]/g, '');
                                    const dropWireDistance = distanceStr ? parseFloat(distanceStr) : undefined;
                                    const completedDate = sltApiService.parseStatusDate(sltData.CON_STATUS_DATE) || new Date();

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
                                    console.log(`[COMPLETED-SOD-SYNC] [SUCCESS] ✅ Updated ${sltData.SO_NUM} (ID: ${localSOD.id}) from ${localSOD.sltsStatus}/${localSOD.status}`);
                                }
                            } else {
                                // Check if already completed
                                const alreadyCompleted = await prisma.serviceOrder.findFirst({
                                    where: { soNum: sltData.SO_NUM, sltsStatus: 'COMPLETED' },
                                    select: { id: true, statusDate: true, completedDate: true }
                                });

                                if (!alreadyCompleted) {
                                    console.log(`[COMPLETED-SOD-SYNC] [DEBUG] 🆕 SOD ${sltData.SO_NUM} NOT found. Creating as COMPLETED...`);

                                    const distanceStr = sltData.FTTH_INST_SIET?.replace(/[^0-9.]/g, '');
                                    const dropWireDistance = distanceStr ? parseFloat(distanceStr) : undefined;
                                    const completedDate = sltApiService.parseStatusDate(sltData.CON_STATUS_DATE) || new Date();

                                    await prisma.serviceOrder.create({
                                        data: {
                                            opmcId: opmc.id, rtom: opmc.rtom, lea: sltData.LEA, soNum: sltData.SO_NUM,
                                            voiceNumber: sltData.VOICENUMBER, orderType: sltData.ORDER_TYPE,
                                            serviceType: sltData.S_TYPE, customerName: sltData.CON_CUS_NAME,
                                            techContact: sltData.CON_TEC_CONTACT, status: sltData.CON_STATUS,
                                            sltsStatus: 'COMPLETED', sltsPatStatus: sltData.CON_STATUS,
                                            statusDate: completedDate,
                                            completedDate: completedDate, address: sltData.ADDRE, dp: sltData.DP,
                                            package: sltData.PKG, woroTaskName: sltData.CON_WORO_TASK_NAME,
                                            iptv: sltData.IPTV, woroSeit: sltData.CON_WORO_SEIT, dpDetails: sltData.DP,
                                            ontSerialNumber: sltData.CON_WORO_SEIT || undefined,
                                            iptvSerialNumbers: sltData.IPTV || undefined,
                                            dropWireDistance: dropWireDistance,
                                            comments: `Created directly as COMPLETED from SLT List`
                                        }
                                    });
                                    completedCount++;
                                }
                            }
                        } catch (itemErr) {
                            console.error(`[COMPLETED-SOD-SYNC] [ITEM-ERROR] SOD ${sltData.SO_NUM}:`, itemErr);
                        }
                    }
                } catch (opmcErr) {
                    console.error(`[COMPLETED-SOD-SYNC] [OPMC-ERROR] OPMC ${opmc.name}:`, opmcErr);
                }
            }

            console.log(`[COMPLETED-SOD-SYNC] ✅ Completed ${completedCount} SODs from ${checkedCount} SLT records`);

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
