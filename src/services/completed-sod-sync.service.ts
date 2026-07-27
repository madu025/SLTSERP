import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { sltApiService } from './slt-api.service';
import { ServiceOrderService } from './sod.service';
import { SodStatus } from '@/lib/constants/sod-constants';
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
            startDate = customStartDate;
        } else {
            // Strictly Current Month: 1st of current month to end of current month
            startDate = format(startOfMonth(today), 'yyyy-MM-dd');
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
                        if (r.SO_NUM) {
                            uniqueCompletedMap.set(r.SO_NUM, r);
                        }
                    });
                    const uniqueResults = Array.from(uniqueCompletedMap.values());

                    console.log(`[COMPLETED-SOD-SYNC] [DEBUG] 📡 Found ${uniqueResults.length} unique completed records for ${opmc.rtom}`);

                    // Batch query matching local service orders to resolve N+1 issue
                    const allSoNums = uniqueResults.map(r => r.SO_NUM);
                    const localSODsBatch = allSoNums.length > 0 ? await prisma.serviceOrder.findMany({
                        where: { soNum: { in: allSoNums } },
                        select: { id: true, soNum: true, sltsStatus: true, status: true, completedDate: true, ontSerialNumber: true }
                    }) : [];

                    // Group local service orders by soNum in-memory
                    const localSODsMap = new Map<string, Array<{ id: string, soNum: string | null, sltsStatus: string, status: string, completedDate: Date | null, ontSerialNumber: string | null }>>();
                    localSODsBatch.forEach(sod => {
                        const key = sod.soNum;
                        if (key) {
                            if (!localSODsMap.has(key)) {
                                localSODsMap.set(key, []);
                            }
                            localSODsMap.get(key)!.push(sod);
                        }
                    });

                    const resolveSltsStatus = (conStatus: string): SodStatus => {
                        const statusUpper = (conStatus || '').toUpperCase();
                        if (statusUpper === 'INSTALL_CLOSED') return SodStatus.INSTALL_CLOSED;
                        if (statusUpper === 'PROV_CLOSED') return SodStatus.PROV_CLOSED;
                        if (statusUpper.includes('RETURN') || statusUpper.includes('REJECT') || statusUpper.includes('CANCEL')) {
                            return SodStatus.RETURN;
                        }
                        return SodStatus.COMPLETED;
                    };

                    // Batch objects
                    const missingSodsToCreate: Prisma.ServiceOrderCreateManyInput[] = [];

                    // Process each unique completed SOD record sequentially for existing (to protect ledger tx)
                    // and collect missing ones for a single bulk insert
                    for (const sltData of uniqueResults) {
                        try {
                            const finalSltsStatus = resolveSltsStatus(sltData.CON_STATUS);
                            const isWiredOnly = finalSltsStatus === SodStatus.PROV_CLOSED;

                            // CHECK MAP: Look for ANY record with this SO_NUM
                            const localSODs = localSODsMap.get(sltData.SO_NUM) || [];

                            const completedDate = sltApiService.parseStatusDate(sltData.CON_STATUS_DATE) || new Date();
                            const distanceStr = sltData.FTTH_INST_SIET?.replace(/[^0-9.]/g, '');
                            const dropWireDistance = distanceStr ? parseFloat(distanceStr) : undefined;

                            if (localSODs.length > 0) {
                                // CASE A: Exists
                                // Update if status differs or completedDate missing
                                for (const localSOD of localSODs) {
                                    if (localSOD.sltsStatus !== finalSltsStatus || !localSOD.completedDate) {
                                        await ServiceOrderService.patchServiceOrder(
                                            localSOD.id,
                                            {
                                                status: sltData.CON_STATUS,
                                                sltsStatus: finalSltsStatus,
                                                completedDate: finalSltsStatus === SodStatus.COMPLETED ? completedDate : localSOD.completedDate,
                                                wiredOnly: isWiredOnly,
                                                dpDetails: sltData.DP,
                                                ontSerialNumber: localSOD.ontSerialNumber ? localSOD.ontSerialNumber : (sltData.CON_WORO_SEIT || undefined),
                                                iptvSerialNumbers: (sltData.IPTV && String(sltData.IPTV).trim().length > 5) ? [String(sltData.IPTV).trim()] : undefined,
                                                dropWireDistance: dropWireDistance,
                                                comments: `Auto-updated via Sync (${sltData.CON_STATUS})`,
                                            }
                                        );
                                        completedCount++;
                                    }
                                }
                            } else {
                                // CASE B: DOES NOT EXIST (Missing History)
                                missingSodsToCreate.push({
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
                                    completedDate: finalSltsStatus === SodStatus.COMPLETED ? completedDate : null,

                                    // Other
                                    comments: 'Auto-created from Missing History Sync',
                                    dropWireDistance: dropWireDistance,
                                    wiredOnly: isWiredOnly,
                                });
                            }
                        } catch (err) {
                            console.error(`[COMPLETED-SOD-SYNC] [ERROR] Processing SOD ${sltData.SO_NUM} failed:`, err);
                            errors.push(`Processing specific SOD ${sltData.SO_NUM} failed: ${(err as Error).message}`);
                        }
                    }

                    // Perform Batch Insert for all missing SODs
                    if (missingSodsToCreate.length > 0) {
                        try {
                            const result = await prisma.serviceOrder.createMany({
                                data: missingSodsToCreate,
                                skipDuplicates: true
                            });
                            completedCount += result.count;
                        } catch (batchErr) {
                            console.error(`[COMPLETED-SOD-SYNC] [BATCH-ERROR] OPMC ${opmc.name} Batch Insert Failed:`, batchErr);
                            errors.push(`Batch Insert for OPMC ${opmc.name} failed: ${(batchErr as Error).message}`);
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
