import { prisma } from '@/lib/prisma';
import { sltApiService } from './slt-api.service';
import { ServiceOrderService } from './sod.service';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';

export class CompletedSODSyncService {
    /**
     * Sync completed SODs based on PAT success data
     * This uses the existing PAT success endpoint which works
     */
    static async syncCompletedSODs(customStartDate?: string): Promise<{
        checked: number;
        completed: number;
        errors: string[];
    }> {
        console.log(`[COMPLETED-SOD-SYNC] Starting sync... (Mode: ${customStartDate ? 'FULL HISTORY' : 'BACKGROUND/RECENT'})`);

        const today = new Date();

        let startDate: string;
        if (customStartDate) {
            // For Admin Panel / One-time full sync (e.g., '2026-01-01')
            startDate = customStartDate;
        } else {
            // For Background Process: Sync Last Month + Current Month
            // This covers the "relevant month" requirement + buffer for late updates
            const lastMonth = subMonths(today, 1);
            startDate = format(startOfMonth(lastMonth), 'yyyy-MM-dd');
        }

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
                    console.log(`[COMPLETED-SOD-SYNC] [DEBUG] 🔍 Checking OPMC: ${opmc.name} (${opmc.rtom}) from ${startDate}`);

                    // 1. First Sync Pending SODs
                    // We keep this to ensure we try to get pending items regularly
                    try {
                        const pendingStats = await ServiceOrderService.syncServiceOrders(opmc.id, opmc.rtom);
                        console.log(`[COMPLETED-SOD-SYNC] [DEBUG] Pending Sync Results: Created ${pendingStats.created}, Updated ${pendingStats.updated}`);
                    } catch (err) {
                        console.error(`[COMPLETED-SOD-SYNC] [ERROR] Pending sync failed:`, err);
                    }

                    // 2. Fetch Completed SODs
                    // We fetch the FULL list from 2026-01-01
                    const completedResults = await sltApiService.fetchCompletedSODs(opmc.rtom, startDate, endDate);
                    checkedCount += completedResults.length;

                    console.log(`[COMPLETED-SOD-SYNC] [DEBUG] 📡 Found ${completedResults.length} records in SLT for ${opmc.rtom}`);

                    // Process each completed SOD record
                    for (const sltData of completedResults) {
                        try {
                            // Strict Completion Check
                            const completionStatuses = ['PROV_CLOSED', 'COMPLETED', 'INSTALL_CLOSED', 'PAT_OPMC_PASSED', 'PAT_CORRECTED'];
                            if (!completionStatuses.includes(sltData.CON_STATUS)) {
                                continue;
                            }

                            // CHECK DB: Look for ANY record with this SO_NUM
                            const localSODs = await prisma.serviceOrder.findMany({
                                where: { soNum: sltData.SO_NUM },
                                select: { id: true, sltsStatus: true, status: true, completedDate: true }
                            });

                            const completedDate = sltApiService.parseStatusDate(sltData.CON_STATUS_DATE) || new Date();
                            const distanceStr = sltData.FTTH_INST_SIET?.replace(/[^0-9.]/g, '');
                            const dropWireDistance = distanceStr ? parseFloat(distanceStr) : undefined;

                            if (localSODs.length > 0) {
                                // CASE A: Exists
                                // Update if not already marked as COMPLETED in our system OR if specific details are missing (e.g. date)
                                for (const localSOD of localSODs) {
                                    if (localSOD.sltsStatus !== 'COMPLETED' || !localSOD.completedDate) {

                                        const isProvClosed = sltData.CON_STATUS === 'PROV_CLOSED';
                                        const finalSltsStatus = isProvClosed ? 'PROV_CLOSED' : 'COMPLETED';
                                        const isWiredOnly = isProvClosed;

                                        console.log(`[COMPLETED-SOD-SYNC] [DEBUG] ♻️ Updating SOD: ${sltData.SO_NUM} (${finalSltsStatus})`);

                                        await ServiceOrderService.patchServiceOrder(
                                            localSOD.id,
                                            {
                                                status: sltData.CON_STATUS,
                                                sltsStatus: finalSltsStatus,
                                                sltsPatStatus: sltData.CON_STATUS,
                                                completedDate: completedDate,
                                                wiredOnly: isWiredOnly,
                                                dpDetails: sltData.DP,
                                                ontSerialNumber: sltData.CON_WORO_SEIT || undefined,
                                                iptvSerialNumbers: sltData.IPTV || undefined,
                                                dropWireDistance: dropWireDistance,
                                                comments: `Auto-updated via Sync (${sltData.CON_STATUS})`,
                                            }
                                        );
                                        completedCount++;
                                    }
                                }
                            } else {
                                // CASE B: DOES NOT EXIST (Missing History)
                                // Create new record directly
                                console.log(`[COMPLETED-SOD-SYNC] [DEBUG] 🆕 Creating MISSING Historical SOD: ${sltData.SO_NUM}`);

                                const isProvClosed = sltData.CON_STATUS === 'PROV_CLOSED';
                                const finalSltsStatus = isProvClosed ? 'PROV_CLOSED' : 'COMPLETED';
                                const isWiredOnly = isProvClosed;

                                await prisma.serviceOrder.create({
                                    data: {
                                        opmcId: opmc.id,
                                        rtom: sltData.RTOM || opmc.rtom,
                                        soNum: sltData.SO_NUM,
                                        lea: sltData.LEA,
                                        voiceNumber: sltData.VOICENUMBER,
                                        orderType: sltData.ORDER_TYPE,
                                        serviceType: sltData.S_TYPE,
                                        customerName: sltData.CON_CUS_NAME,
                                        techContact: sltData.CON_TEC_CONTACT,
                                        address: sltData.ADDRE,
                                        dp: sltData.DP,
                                        package: sltData.PKG,
                                        ospPhoneClass: sltData.CON_OSP_PHONE_CLASS,
                                        phonePurchase: sltData.CON_PHN_PURCH,
                                        sales: sltData.CON_SALES,
                                        woroTaskName: sltData.CON_WORO_TASK_NAME,
                                        iptv: sltData.IPTV,
                                        woroSeit: sltData.CON_WORO_SEIT,
                                        ftthInstSeit: sltData.FTTH_INST_SIET,
                                        ftthWifi: sltData.FTTH_WIFI,

                                        // Status fields
                                        status: sltData.CON_STATUS,
                                        sltsStatus: finalSltsStatus,
                                        sltsPatStatus: sltData.CON_STATUS,

                                        // Dates
                                        receivedDate: completedDate,
                                        statusDate: completedDate,
                                        completedDate: completedDate,

                                        // Other
                                        comments: 'Auto-created from Missing History Sync',
                                        dropWireDistance: dropWireDistance,
                                        wiredOnly: isWiredOnly,
                                    }
                                });
                                completedCount++;
                            }
                        } catch (err) {
                            console.error(`[COMPLETED-SOD-SYNC] [ERROR] Processing SOD ${sltData.SO_NUM} failed:`, err);
                            errors.push(`Processing specific SOD ${sltData.SO_NUM} failed: ${(err as Error).message}`);
                        }
                    }
                } catch (opmcErr) {
                    console.error(`[COMPLETED-SOD-SYNC] [OPMC-ERROR] OPMC ${opmc.name}:`, opmcErr);
                    errors.push(`Processing OPMC ${opmc.name} failed: ${(opmcErr as Error).message}`);
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
