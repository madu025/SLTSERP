import { prisma } from '@/lib/prisma';
import { sltApiService } from './slt-api.service';
import { ServiceOrderService } from './sod.service';
import { SodStatus, SOD_COMPLETION_STATUSES } from '@/lib/constants/sod-constants';
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
                select: { id: true, name: true, rtom: true },
                orderBy: { rtom: 'asc' }
            });

            for (const opmc of opmcs) {
                try {
                    console.log(`[COMPLETED-SOD-SYNC] [DEBUG] 🔍 Checking OPMC: ${opmc.name} (${opmc.rtom}) from ${startDate}`);

                    // 1. Fetch Completed SODs
                    const completedResults = await sltApiService.fetchCompletedSODs(opmc.rtom, startDate, endDate);
                    checkedCount += completedResults.length;

                    // Deduplicate results to prevent collisions in the loop
                    const uniqueCompletedMap = new Map();
                    completedResults.forEach(r => {
                        if (r.CON_STATUS === 'INSTALL_CLOSED') {
                            uniqueCompletedMap.set(r.SO_NUM, r);
                        }
                    });
                    const uniqueResults = Array.from(uniqueCompletedMap.values());

                    console.log(`[COMPLETED-SOD-SYNC] [DEBUG] 📡 Found ${uniqueResults.length} unique completed records for ${opmc.rtom}`);

                    // Batch query matching local service orders to resolve N+1 issue
                    const allSoNums = uniqueResults.map(r => r.SO_NUM);
                    const localSODsBatch = allSoNums.length > 0 ? await prisma.serviceOrder.findMany({
                        where: { soNum: { in: allSoNums } },
                        select: { id: true, soNum: true, sltsStatus: true, status: true, completedDate: true }
                    }) : [];

                    // Group local service orders by soNum in-memory
                    const localSODsMap = new Map<string, Array<{ id: string, soNum: string | null, sltsStatus: string, status: string, completedDate: Date | null }>>();
                    localSODsBatch.forEach(sod => {
                        const key = sod.soNum;
                        if (key) {
                            if (!localSODsMap.has(key)) {
                                localSODsMap.set(key, []);
                            }
                            localSODsMap.get(key)!.push(sod);
                        }
                    });

                    // Process each unique completed SOD record in batches
                    const CHUNK_SIZE = 10;
                    for (let i = 0; i < uniqueResults.length; i += CHUNK_SIZE) {
                        const chunk = uniqueResults.slice(i, i + CHUNK_SIZE);
                        await Promise.all(chunk.map(async (sltData) => {
                            try {
                                if (!SOD_COMPLETION_STATUSES.includes(sltData.CON_STATUS as SodStatus)) {
                                    return;
                                }

                                // CHECK MAP: Look for ANY record with this SO_NUM
                                const localSODs = localSODsMap.get(sltData.SO_NUM) || [];

                                const completedDate = sltApiService.parseStatusDate(sltData.CON_STATUS_DATE) || new Date();
                                const distanceStr = sltData.FTTH_INST_SIET?.replace(/[^0-9.]/g, '');
                                const dropWireDistance = distanceStr ? parseFloat(distanceStr) : undefined;

                                if (localSODs.length > 0) {
                                    // CASE A: Exists
                                    // Update if not already marked as COMPLETED in our system OR if specific details are missing (e.g. date)
                                    for (const localSOD of localSODs) {
                                        if (localSOD.sltsStatus !== SodStatus.COMPLETED || !localSOD.completedDate) {

                                            const isProvClosed = sltData.CON_STATUS === SodStatus.PROV_CLOSED;
                                            const finalSltsStatus = isProvClosed ? SodStatus.PROV_CLOSED : SodStatus.COMPLETED;
                                            const isWiredOnly = isProvClosed;

                                            console.log(`[COMPLETED-SOD-SYNC] [DEBUG] ♻️ Updating SOD: ${sltData.SO_NUM} (${finalSltsStatus})`);

                                            await ServiceOrderService.patchServiceOrder(
                                                localSOD.id,
                                                {
                                                    status: sltData.CON_STATUS,
                                                    sltsStatus: finalSltsStatus,
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

                                    const isProvClosed = sltData.CON_STATUS === SodStatus.PROV_CLOSED;
                                    const finalSltsStatus = isProvClosed ? SodStatus.PROV_CLOSED : SodStatus.COMPLETED;
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
                        }));
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
     * Start periodic sync (every 1 hour)
     */
    private static intervalId: NodeJS.Timeout | null = null;

    static startPeriodicSync(): void {
        if (this.intervalId) {
            console.log('[COMPLETED-SOD-SYNC] Already running');
            return;
        }

        console.log('[COMPLETED-SOD-SYNC] Starting periodic sync (10-minute intervals)');

        // Run immediately
        this.syncCompletedSODs();

        // Then every 10 minutes
        this.intervalId = setInterval(() => {
            this.syncCompletedSODs();
        }, 10 * 60 * 1000);
    }

    static stopPeriodicSync(): void {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
            console.log('[COMPLETED-SOD-SYNC] Stopped');
        }
    }
}
