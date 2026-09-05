import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { sltApiService } from '@/services/slt/slt-api.service';
import { ServiceOrderService } from '@/services/service-order/sod.service';
import { SODLifecycleService, SERVICE_ORDER_STATUS_VALUES } from '@/services/service-order/sod.lifecycle.service';
import { SodStatus, backfillReceiptDate } from '@/lib/constants/sod-constants';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { applySodStatus, countDecision } from './sync/sod-status.writer';
import { SyncAuditService, tickWindow } from './sync/sync-audit.service';
import { emptySyncCounters } from './sync/types';

export class CompletedSODSyncService {
    /**
     * Sync completed SODs based on PAT success data
     * This uses the existing PAT success endpoint which works
     *
     * Census: one SyncRun row per Master Tick bucket. The data window is deliberately wide (the whole
     * current month, so late-arriving closures are never missed), which is why the dedup key is the
     * tick bucket and not the date range - see tickWindow(). A double-fired tick inside the same
     * bucket resolves to the same key and is refused instead of re-walking and re-notifying.
     */
    static async syncCompletedSODs(customStartDate?: string): Promise<{
        checked: number;
        completed: number;
        enriched: number;
        blockedByPolicy: number;
        errors: string[];
    }> {
        const run = await SyncAuditService.startRun({ feed: 'COMPLETED', window: tickWindow() });
        if (run.state !== 'STARTED') {
            console.log(`[COMPLETED-SOD-SYNC] Pass refused (${run.state}, key ${run.windowKey})`);
            return { checked: 0, completed: 0, enriched: 0, blockedByPolicy: 0, errors: [] };
        }

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
        const counters = emptySyncCounters();
        const decisions: Record<string, number> = {};
        let completedCount = 0;
        let enrichedCount = 0;
        let checkedCount = 0;
        let blockedByPolicy = 0;

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

                    // 2. Fetch APPROVED (PAT_PASSED) SODs — fully completed, merge into same processing
                    const approvedResults = await sltApiService.fetchApprovedSODs(opmc.rtom, startDate, endDate);

                    const allResults = [...completedResults, ...approvedResults];
                    checkedCount += allResults.length;

                    // Deduplicate results to prevent collisions in the loop
                    const uniqueCompletedMap = new Map();
                    allResults.forEach(r => {
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
                        select: { id: true, soNum: true, opmcId: true, sltsStatus: true, status: true, completedDate: true, customerName: true, ontSerialNumber: true, receivedDate: true, statusDate: true, orderType: true, package: true, serviceType: true, lea: true, woroTaskName: true, woroSeit: true, ftthInstSeit: true, ftthWifi: true, iptv: true }
                    }) : [];

                    // Group local service orders by soNum in-memory
                    type LocalSodRow = { id: string, soNum: string | null, opmcId: string, sltsStatus: string, status: string, completedDate: Date | null, customerName: string | null, ontSerialNumber: string | null, receivedDate: Date | null, statusDate: Date | null, orderType: string | null, package: string | null, serviceType: string | null, lea: string | null, woroTaskName: string | null, woroSeit: string | null, ftthInstSeit: string | null, ftthWifi: string | null, iptv: string | null };
                    const localSODsMap = new Map<string, LocalSodRow[]>();
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
                        // Preserve INSTALL_CLOSED explicitly
                        if (statusUpper === 'INSTALL_CLOSED') return SodStatus.INSTALL_CLOSED;
                        // PAT_OPMC_REJECTED from COMPLETED_SLTS endpoint means work is done (quality issue only)
                        // Per domain rule: all records from COMPLETED_SLTS are work-order complete
                        if (statusUpper === 'PAT_OPMC_REJECTED') return SodStatus.COMPLETED;
                        // Delegate the rest to the canonical mapper
                        return SODLifecycleService.mapExternalStatusToSltsStatus(statusUpper) as SodStatus;
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

                            const rawCompletedDate = sltApiService.parseStatusDate(sltData.CON_STATUS_DATE) || new Date();
                            // For returned SODs that are re-completed, CON_STATUS_DATE might be the original date
                            // Use receivedDate (reactivation date) if it's later than CON_STATUS_DATE
                            const completedDate = (localSODs[0]?.receivedDate && rawCompletedDate < localSODs[0].receivedDate)
                                ? localSODs[0].receivedDate
                                : rawCompletedDate;
                            const isCompletionStatus = finalSltsStatus === SodStatus.COMPLETED || finalSltsStatus === SodStatus.INSTALL_CLOSED;
                            // Receipt anchor: the portal sends no received-on value for closed
                            // records, and stamping the completion instant as the receipt date made
                            // August jobs show up as "Received Today". Use the date embedded in the
                            // SOD number (never later than the completion).
                            const receiptDate = backfillReceiptDate(sltData.SO_NUM, completedDate);
                            // Enum-guard legacy status — raw portal strings outside the enum must not hit Prisma
                            // For the `status` field: fall back to finalSltsStatus when legacyStatus is undefined
                            // (e.g. PROV_CLOSED is valid for sltsStatus but may not be in the legacy status enum)
                            const rawStatus = (sltData.CON_STATUS || '').toUpperCase();
                            const legacyStatus = SERVICE_ORDER_STATUS_VALUES.has(rawStatus)
                                ? rawStatus
                                : finalSltsStatus;
                            const distanceStr = sltData.FTTH_INST_SIET?.replace(/[^0-9.]/g, '');
                            const dropWireDistance = distanceStr ? parseFloat(distanceStr) : undefined;

                            if (localSODs.length > 0) {
                                // CASE A: Exists
                                // Update if status differs or completedDate missing
                                for (const localSOD of localSODs) {
                                    // INSTALL_CLOSED is a terminal status — never override to COMPLETED
                                    // (COMPLETED_SLTS endpoint may return PAT_OPMC_PASSED for the same SOD)
                                    const preserveInstallClosed = localSOD.sltsStatus === 'INSTALL_CLOSED' && finalSltsStatus !== SodStatus.INSTALL_CLOSED;
                                    const effectiveSltsStatus = preserveInstallClosed ? SodStatus.INSTALL_CLOSED : finalSltsStatus;
                                    const effectiveLegacyStatus = preserveInstallClosed ? 'INSTALL_CLOSED' : legacyStatus;

                                    if (localSOD.sltsStatus !== effectiveSltsStatus || !localSOD.completedDate) {
                                        // If SOD was previously DISAPPEARED, clear the stale
                                        // "[AUTO-SYNC] Disappeared from active portal list" comment
                                        const wasDisappeared = localSOD.sltsStatus === SodStatus.DISAPPEARED;
                                    
                                        // Status identity goes through the single writer (defect O10: this
                                        // feed used to write status through the facade and then patch it
                                        // again with a raw update). Everything else stays a normal update.
                                        const write = await applySodStatus({
                                            sodId: localSOD.id,
                                            soNum: localSOD.soNum as string,
                                            opmcId: localSOD.opmcId,
                                            next: {
                                                sltsStatus: effectiveSltsStatus,
                                                status: effectiveLegacyStatus,
                                                completedDate: isCompletionStatus ? completedDate : localSOD.completedDate,
                                            },
                                            anchor: completedDate,
                                            actor: 'PORTAL_COMPLETED',
                                            reason: 'COMPLETED_FEED',
                                        });
                                        countDecision(decisions, write.decision, write.wouldHaveBlocked);
                                        if (!write.changed) counters.skippedNoChange++;
                                    
                                        await ServiceOrderService.updateServiceOrder(
                                            localSOD.id,
                                            {
                                                wiredOnly: isWiredOnly,
                                                dpDetails: sltData.DP,
                                                ontSerialNumber: localSOD.ontSerialNumber ? localSOD.ontSerialNumber : (sltData.CON_WORO_SEIT || undefined),
                                                iptvSerialNumbers: (sltData.IPTV && String(sltData.IPTV).trim().length > 5) ? [String(sltData.IPTV).trim()] : undefined,
                                                dropWireDistance: dropWireDistance,
                                                comments: wasDisappeared ? null : `Auto-updated via Sync (${sltData.CON_STATUS})`,
                                            },
                                            'SYNC_SERVICE'
                                        );
                                    
                                        if (write.refusedByPolicy) {
                                            blockedByPolicy++;
                                            console.log(`[COMPLETED-SYNC] ${localSOD.soNum} refused by the status policy (${write.decision.reason}${write.wouldHaveBlocked ? ', logonly: written anyway' : ''}).`);
                                        }
                                        completedCount++;
                                    } else if (!localSOD.customerName && sltData.CON_CUS_NAME) {
                                        // Identity backfill: bridge-born SODs completed via the contractor
                                        // portal view are created without customer fields (the contr/sod_details
                                        // scrape carries no CON_CUS_NAME/ADDRE, and the SLT API fallback is
                                        // skipped on create because the RTOM is not yet resolvable), and the
                                        // status guard above skips them forever once COMPLETED with a date.
                                        // Null-fill identity fields from the OPMC completed record —
                                        // existing values are never overwritten.
                                        await prisma.serviceOrder.update({
                                            where: { id: localSOD.id },
                                            data: {
                                                customerName: sltData.CON_CUS_NAME,
                                                ...(sltData.ADDRE ? { address: sltData.ADDRE } : {}),
                                                ...(sltData.CON_TEC_CONTACT ? { techContact: sltData.CON_TEC_CONTACT } : {}),
                                            }
                                        });
                                        enrichedCount++;
                                    }

                                    // Born-terminal event seeding: a bridge-born SOD created already
                                    // COMPLETED/INSTALL_CLOSED has no truthful completion event
                                    // (bridgeSync skips the history row rather than label it with
                                    // the push time). The guard above fired because completedDate
                                    // was missing — now that the portal's true date is known, seed
                                    // the event once, dated with the real completion date. The
                                    // findFirst guard also skips rows whose status change already
                                    // wrote the event via the lifecycle path.
                                    if (localSOD.sltsStatus === effectiveSltsStatus && !localSOD.completedDate && completedDate) {
                                        const existingEvent = await prisma.serviceOrderStatusHistory.findFirst({
                                            where: { serviceOrderId: localSOD.id, status: effectiveSltsStatus }
                                        });
                                        if (!existingEvent) {
                                            await prisma.serviceOrderStatusHistory.create({
                                                data: {
                                                    serviceOrderId: localSOD.id,
                                                    status: effectiveSltsStatus,
                                                    statusDate: completedDate
                                                }
                                            });
                                        }
                                    }

                                    // Born-row detail backfill: the contractor-view scrape carries
                                    // no orderType/package/serviceType (etc.), so bridge-born SODs
                                    // display "-" everywhere and land in the Daily Report's DT
                                    // catch-all. Null-fill every field the OPMC completed record
                                    // carries — existing values are never overwritten. receivedDate
                                    // and statusDate follow the CASE B convention: the order-raise
                                    // date from the SOD number, and the portal closure instant.
                                    const bornDetailFill = {
                                        ...(!localSOD.orderType && sltData.ORDER_TYPE ? { orderType: sltData.ORDER_TYPE } : {}),
                                        ...(!localSOD.package && sltData.PKG ? { package: sltData.PKG } : {}),
                                        ...(!localSOD.serviceType && sltData.S_TYPE ? { serviceType: sltData.S_TYPE } : {}),
                                        ...(!localSOD.lea && sltData.LEA ? { lea: sltData.LEA } : {}),
                                        ...(!localSOD.woroTaskName && sltData.CON_WORO_TASK_NAME ? { woroTaskName: sltData.CON_WORO_TASK_NAME } : {}),
                                        ...(!localSOD.woroSeit && sltData.CON_WORO_SEIT ? { woroSeit: sltData.CON_WORO_SEIT } : {}),
                                        ...(!localSOD.ftthInstSeit && sltData.FTTH_INST_SIET ? { ftthInstSeit: sltData.FTTH_INST_SIET } : {}),
                                        ...(!localSOD.ftthWifi && sltData.FTTH_WIFI ? { ftthWifi: sltData.FTTH_WIFI } : {}),
                                        ...(!localSOD.iptv && sltData.IPTV && String(sltData.IPTV).trim().length > 5 ? { iptv: sltData.IPTV } : {}),
                                        ...(!localSOD.receivedDate && receiptDate ? { receivedDate: receiptDate } : {}),
                                        ...(!localSOD.statusDate && completedDate ? { statusDate: completedDate } : {}),
                                    };
                                    if (Object.keys(bornDetailFill).length > 0) {
                                        await prisma.serviceOrder.update({
                                            where: { id: localSOD.id },
                                            data: bornDetailFill
                                        });
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

                                    // Status fields (enum-safe: fall back to resolved sltsStatus, never raw portal strings)
                                    status: (legacyStatus || finalSltsStatus) as Prisma.ServiceOrderCreateManyInput['status'],
                                    sltsStatus: finalSltsStatus,

                                    // Dates — receivedDate is the order-raise date, never the
                                    // closure instant (see receiptDate above).
                                    receivedDate: receiptDate,
                                    statusDate: completedDate,
                                    completedDate: isCompletionStatus ? completedDate : null,

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
                            counters.created += result.count;
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

            console.log(`[COMPLETED-SOD-SYNC] Completed ${completedCount} SODs from ${checkedCount} SLT records (${blockedByPolicy} policy refusals)`);

            counters.fetched = checkedCount;
            counters.updated = completedCount - counters.created;
            counters.blockedByPolicy = blockedByPolicy;
            await SyncAuditService.finishRun(run.runId, { counters, decisions, errors });

            return {
                checked: checkedCount,
                completed: completedCount,
                enriched: enrichedCount,
                blockedByPolicy,
                errors
            };

        } catch (error) {
            await SyncAuditService.recordError({ feed: 'COMPLETED', context: 'syncCompletedSODs', error, runId: run.runId });
            counters.fetched = checkedCount;
            await SyncAuditService.finishRun(run.runId, { counters, decisions, errors });
            return {
                checked: 0,
                completed: 0,
                enriched: 0,
                blockedByPolicy,
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
