import { ROLE_GROUPS } from '@/config/roles';
import { prisma } from '@/lib/prisma';
import { Prisma, ServiceOrder } from '@prisma/client';
import { sltApiService, SLTServiceOrderData, SLTPATData } from '@/services/slt/slt-api.service';
import { addJob, statsUpdateQueue, sodSyncQueue } from '../../lib/queue';
import { UUID } from '@/types/common';
import { SODMaterialService } from './sod.material.service';
import { LedgerService } from '../finance/ledger.service';
import { SODReturnClassifierService } from './sod-return-classifier.service';
import { SODLifecycleService, SERVICE_ORDER_STATUS_VALUES } from './sod.lifecycle.service';
import { SodUtils } from './sod.utils';
import { SystemConfigService } from '@/services/core/system-config.service';
import { SodStatus, SOD_RETURN_STATUSES } from '@/lib/constants/sod-constants';
import { MaterialUsageInput } from '@/types/service-order/sod-sync.types';
import { format, subMonths } from 'date-fns';
import { safe } from '@/utils/safe-await.util';

interface SyncStats {
    queuedCount: number;
    jobIds: string[];
    lastSyncTriggered: string;
    created: number;
    updated: number;
    failed: number;
}

interface MaterialDetailInput {
    CODE?: string;
    TYPE?: string;
    NAME?: string;
    QTY?: string | number;
    qty?: string | number;
    SERIAL?: string;
    RAW?: Record<string, string>;
}

export class SODSyncService {
    /**
     * Upsert PAT status records — replaces DELETE+INSERT pattern (saves 1 query per batch).
     * Uses INSERT ... ON CONFLICT (soNum) DO UPDATE since soNum is @unique.
     */
    private static async upsertPatStatusBatch(records: Prisma.SLTPATStatusCreateManyInput[]): Promise<number> {
        if (records.length === 0) return 0;
        const cols = ['"soNum"', '"rtom"', '"lea"', '"voiceNumber"', '"sType"', '"orderType"',
            '"task"', '"package"', '"conName"', '"patUser"', '"status"', '"source"', '"statusDate"', '"hasDuplicate"'];
        const updateCols = cols.filter(c => c !== '"soNum"').map(c => `${c} = EXCLUDED.${c}`);
        const sql = `INSERT INTO "SLTPATStatus" (${cols.join(', ')}) VALUES ${records.map((_, i) =>
            `(${cols.map((_, j) => `$${i * cols.length + j + 1}`).join(', ')})`
        ).join(', ')} ON CONFLICT ("soNum") DO UPDATE SET ${updateCols.join(', ')}`;
        const flatValues = records.flatMap(r => [
            r.soNum, r.rtom ?? null, r.lea ?? null, r.voiceNumber ?? null,
            r.sType ?? null, r.orderType ?? null, r.task ?? null, r.package ?? null,
            r.conName ?? null, r.patUser ?? null, r.status, r.source,
            r.statusDate ?? null, r.hasDuplicate ?? false
        ]);
        const result = await prisma.$executeRawUnsafe(sql, ...flatValues);
        return result;
    }
    /**
     * Sync PAT results from SLT APIs (OPMC Rejected and PAT Success)
     */
    static async syncPatResults(opmcId: UUID, rtom: string) {
        const [err, results] = await safe(Promise.all([
            sltApiService.fetchPATResults(rtom),
            sltApiService.fetchOpmcRejected(rtom)
        ]));

        if (err || !results) {
            console.error('[PAT-SYNC] Sync Failed:', err);
            return { total: 0, error: String(err) };
        }

        const sltData = [
            ...(results[0] || []),
            ...(results[1] || [])
        ];

            if (sltData.length === 0) return { total: 0 };

            const soNums = sltData.map(item => item.SO_NUM);
            const statusHistory = sltData.map(item => ({
                soNum: item.SO_NUM,
                status: item.CON_STATUS,
                source: 'SYNC',
                rtom: item.RTOM,
                lea: item.LEA || '',
                voiceNumber: item.VOICENUMBER,
                sType: item.S_TYPE,
                orderType: item.ORDER_TYPE,
                task: item.CON_WORO_TASK_NAME || '',
                package: item.PKG || '',
                conName: item.CON_NAME || '',
                patUser: item.PAT_USER,
                statusDate: sltApiService.parseStatusDate(item.CON_STATUS_DATE) as Date
            }));

            await SODSyncService.upsertPatStatusBatch(statusHistory as Prisma.SLTPATStatusCreateManyInput[]);

            const matchingOrders = await prisma.serviceOrder.findMany({
                where: {
                    soNum: { in: soNums },
                    sltsStatus: 'COMPLETED'
                },
                select: { id: true, soNum: true, sltsPatStatus: true, hoPatStatus: true }
            });

            const sltDataMap = new Map(sltData.map(item => [item.SO_NUM, item]));

            // Bulk sync PAT statuses via fn_bulk_pat_status_sync (single DB call replaces N+1 chunked updates)
            if (matchingOrders.length > 0) {
                const soNums = matchingOrders.map(o => o.soNum!);
                const statuses = matchingOrders.map(o => {
                    const match = sltDataMap.get(o.soNum || '');
                    return match?.CON_STATUS || 'PENDING';
                });
                const statusDates = matchingOrders.map(o => {
                    const match = sltDataMap.get(o.soNum || '');
                    return match ? sltApiService.parseStatusDate(match.CON_STATUS_DATE) : new Date();
                });

                await prisma.$executeRaw`
                    SELECT fn_bulk_pat_status_sync(
                        ${soNums}::text[],
                        ${statuses}::text[],
                        ${statusDates}::timestamptz[]
                    )
                `;
            }

            if (matchingOrders.length > 0) {
                const [queueErr] = await safe(addJob(statsUpdateQueue, `stats-${opmcId}`, {
                    opmcId,
                    type: 'SINGLE_OPMC'
                }));
                if (queueErr) {
                    console.warn(`[PAT-SYNC] Failed to queue stats update for OPMC ${opmcId}:`, queueErr);
                }
            }

            return { total: sltData.length, updated: matchingOrders.length };
    }

    /**
     * Sync HO Approved PAT results (Global)
     */
    static async syncHoApprovedResults() {
        const [err, initialData] = await safe(sltApiService.fetchHOApprovedGlobal());
        if (err) {
            console.error('[PAT-SYNC] HO Approved Sync Failed:', err);
            return { totalCached: 0, totalUpdated: 0, error: String(err) };
        }
        
        let data = initialData;

        const lastSyncSetting = await prisma.systemSetting.findUnique({ where: { key: 'LAST_HO_APPROVED_SYNC' } });
        const filterDate = lastSyncSetting ? new Date(lastSyncSetting.value as string) : new Date(process.env.SYNC_EPOCH_START || '2020-01-01');

        if (!data || data.length === 0) {
            const dateStr = filterDate.toISOString().split('T')[0];
            const [dateErr, dateData] = await safe(sltApiService.fetchPATResultsByDate(dateStr));
            if (dateErr) {
                console.error('[PAT-SYNC] HO Approved Sync Failed:', dateErr);
                return { totalCached: 0, totalUpdated: 0, error: String(dateErr) };
            }
            data = dateData;
        }

            if (!data || data.length === 0) return { totalCached: 0, totalUpdated: 0 };

            const filteredData = data.filter((item: SLTPATData) => {
                const sDate = sltApiService.parseStatusDate(item.CON_STATUS_DATE);
                return sDate && sDate >= filterDate;
            });

            if (filteredData.length === 0) return { totalCached: 0, totalUpdated: 0 };

            // Identify duplicates first
            const seenSoNums = new Set<string>();
            const duplicateSoNums = new Set<string>();
            for (const item of filteredData) {
                if (seenSoNums.has(item.SO_NUM)) {
                    duplicateSoNums.add(item.SO_NUM);
                } else {
                    seenSoNums.add(item.SO_NUM);
                }
            }

            // Deduplicate by soNum (keeping the most recent statusDate)
            const uniqueMap = new Map<string, SLTPATData>();
            for (const item of filteredData) {
                const existing = uniqueMap.get(item.SO_NUM);
                if (!existing) {
                    uniqueMap.set(item.SO_NUM, item);
                } else {
                    const existingDate = sltApiService.parseStatusDate(existing.CON_STATUS_DATE);
                    const currentDate = sltApiService.parseStatusDate(item.CON_STATUS_DATE);
                    if (currentDate && existingDate && currentDate > existingDate) {
                        uniqueMap.set(item.SO_NUM, item);
                    }
                }
            }
            const dedupedData = Array.from(uniqueMap.values());

            const batchSize = 1000;
            let totalCached = 0;
            let totalUpdated = 0;

            for (let i = 0; i < dedupedData.length; i += batchSize) {
                const batch = dedupedData.slice(i, i + batchSize);
                const cacheData = batch.map((app: SLTPATData) => ({
                    soNum: app.SO_NUM,
                    status: 'PAT_PASSED',
                    source: 'HO_APPROVED',
                    rtom: app.RTOM,
                    lea: app.LEA || '',
                    voiceNumber: app.VOICENUMBER,
                    sType: app.S_TYPE,
                    orderType: app.ORDER_TYPE,
                    task: app.CON_WORO_TASK_NAME || '',
                    package: app.PKG || '',
                    conName: app.CON_NAME || '',
                    patUser: app.PAT_USER,
                    statusDate: sltApiService.parseStatusDate(app.CON_STATUS_DATE) as Date,
                    hasDuplicate: duplicateSoNums.has(app.SO_NUM)
                }));

                const soNums = batch.map((b: SLTPATData) => b.SO_NUM);

                const upserted = await SODSyncService.upsertPatStatusBatch(cacheData as Prisma.SLTPATStatusCreateManyInput[]);
                totalCached += upserted;

                const ordersToUpdate = await prisma.serviceOrder.findMany({
                    where: {
                        soNum: { in: soNums },
                        sltsStatus: 'COMPLETED',
                        hoPatStatus: { not: 'PAT_PASSED' }
                    },
                    select: { id: true, soNum: true, sltsPatStatus: true }
                });

                const batchMap = new Map(batch.map((b: SLTPATData) => [b.SO_NUM, b]));

                // Optimization: Batch UPDATE instead of individual updates (232K → ~100 queries)
                if (ordersToUpdate.length > 0) {
                    const idsToUpdate = ordersToUpdate.map(o => o.id);
                    const invoicableIds = ordersToUpdate.filter(o => o.sltsPatStatus === 'PAT_PASSED').map(o => o.id);
                    const nonInvoicableIds = ordersToUpdate.filter(o => o.sltsPatStatus !== 'PAT_PASSED').map(o => o.id);

                    // Bulk update common fields
                    await prisma.serviceOrder.updateMany({
                        where: { id: { in: idsToUpdate } },
                        data: { hoPatStatus: 'PAT_PASSED', opmcPatStatus: 'PAT_PASSED' }
                    });

                    // Bulk update isInvoicable = true
                    if (invoicableIds.length > 0) {
                        await prisma.serviceOrder.updateMany({
                            where: { id: { in: invoicableIds } },
                            data: { isInvoicable: true }
                        });
                    }

                    // Bulk update isInvoicable = false
                    if (nonInvoicableIds.length > 0) {
                        await prisma.serviceOrder.updateMany({
                            where: { id: { in: nonInvoicableIds } },
                            data: { isInvoicable: false }
                        });
                    }

                    // Update hoPatDate per order (varying dates)
                    for (const order of ordersToUpdate) {
                        const match = batchMap.get(order.soNum || '');
                        if (match) {
                            await prisma.serviceOrder.update({
                                where: { id: order.id },
                                data: { hoPatDate: sltApiService.parseStatusDate(match.CON_STATUS_DATE) }
                            });
                        }
                    }

                    totalUpdated += ordersToUpdate.length;
                }
            }

            const opmcs = await prisma.oPMC.findMany({ select: { id: true } });
            for (const opmc of opmcs) {
                const [queueErr] = await safe(addJob(statsUpdateQueue, `stats-${opmc.id}`, { opmcId: opmc.id, type: 'SINGLE_OPMC' }));
                if (queueErr) {
                    console.warn(`[PAT-SYNC] Failed to queue stats update for OPMC ${opmc.id} (Workers might be disabled):`, queueErr);
                }
            }

            return { totalCached, totalUpdated };
    }

    /**
     * Sync HO Rejected PAT results (Global)
     */
    static async syncHoRejectedResults() {
        const [err, data] = await safe(sltApiService.fetchHORejected());
        if (err) {
            console.error('[PAT-SYNC] HO Rejected Sync Failed:', err);
            return { totalCached: 0, totalUpdated: 0, error: String(err) };
        }

            const lastSyncSetting = await prisma.systemSetting.findUnique({ where: { key: 'LAST_HO_REJECTED_SYNC' } });
            const filterDate = lastSyncSetting ? new Date(lastSyncSetting.value as string) : new Date(process.env.SYNC_EPOCH_START || '2020-01-01');

            if (!data || data.length === 0) return { totalCached: 0, totalUpdated: 0 };

            const filteredData = data.filter((item: SLTPATData) => {
                const sDate = sltApiService.parseStatusDate(item.CON_STATUS_DATE);
                return sDate && sDate >= filterDate;
            });

            if (filteredData.length === 0) return { totalCached: 0, totalUpdated: 0 };

            // Identify duplicates first
            const seenSoNums = new Set<string>();
            const duplicateSoNums = new Set<string>();
            for (const item of filteredData) {
                if (seenSoNums.has(item.SO_NUM)) {
                    duplicateSoNums.add(item.SO_NUM);
                } else {
                    seenSoNums.add(item.SO_NUM);
                }
            }

            // Deduplicate by soNum (keeping the most recent statusDate)
            const uniqueMap = new Map<string, SLTPATData>();
            for (const item of filteredData) {
                const existing = uniqueMap.get(item.SO_NUM);
                if (!existing) {
                    uniqueMap.set(item.SO_NUM, item);
                } else {
                    const existingDate = sltApiService.parseStatusDate(existing.CON_STATUS_DATE);
                    const currentDate = sltApiService.parseStatusDate(item.CON_STATUS_DATE);
                    if (currentDate && existingDate && currentDate > existingDate) {
                        uniqueMap.set(item.SO_NUM, item);
                    }
                }
            }
            const dedupedData = Array.from(uniqueMap.values());

            const batchSize = 1000;
            let totalCached = 0;
            let totalUpdated = 0;

            for (let i = 0; i < dedupedData.length; i += batchSize) {
                const batch = dedupedData.slice(i, i + batchSize);
                const cacheData = batch.map((app: SLTPATData) => ({
                    soNum: app.SO_NUM,
                    status: 'PAT_REJECTED',
                    source: 'HO_REJECTED',
                    rtom: app.RTOM,
                    lea: app.LEA || '',
                    voiceNumber: app.VOICENUMBER,
                    sType: app.S_TYPE,
                    orderType: app.ORDER_TYPE,
                    task: app.CON_WORO_TASK_NAME || '',
                    package: app.PKG || '',
                    conName: app.CON_NAME || '',
                    patUser: app.PAT_USER,
                    statusDate: sltApiService.parseStatusDate(app.CON_STATUS_DATE) as Date,
                    hasDuplicate: duplicateSoNums.has(app.SO_NUM)
                }));

                const soNums = batch.map((b: SLTPATData) => b.SO_NUM);

                const upserted = await SODSyncService.upsertPatStatusBatch(cacheData as Prisma.SLTPATStatusCreateManyInput[]);
                totalCached += upserted;

                const ordersToUpdate = await prisma.serviceOrder.findMany({
                    where: {
                        soNum: { in: soNums },
                        hoPatStatus: { not: 'PAT_REJECTED' }
                    },
                    select: { id: true, soNum: true }
                });

                const batchMap = new Map(batch.map((b: SLTPATData) => [b.SO_NUM, b]));

                // Optimization: Batch UPDATE for common fields, then per-order transactions for rollbacks
                if (ordersToUpdate.length > 0) {
                    const idsToUpdate = ordersToUpdate.map(o => o.id);

                    // Bulk update common fields (hoPatStatus, isInvoicable)
                    await prisma.serviceOrder.updateMany({
                        where: { id: { in: idsToUpdate } },
                        data: { hoPatStatus: 'PAT_REJECTED', isInvoicable: false }
                    });

                    // Per-order transactions for hoPatDate + rollbacks
                    const updateChunkSize = 5;
                    for (let j = 0; j < ordersToUpdate.length; j += updateChunkSize) {
                        const chunk = ordersToUpdate.slice(j, j + updateChunkSize);
                        await Promise.all(chunk.map(async (order) => {
                            const match = batchMap.get(order.soNum || '');
                            if (match) {
                                await prisma.$transaction(async (tx) => {
                                    await tx.serviceOrder.update({
                                        where: { id: order.id },
                                        data: { hoPatDate: sltApiService.parseStatusDate(match.CON_STATUS_DATE) }
                                    });
                                    // Trigger rollbacks since it got HO-rejected
                                    await SODMaterialService.rollbackMaterialUsage(tx, order.id, 'HO_REJECT');
                                    await LedgerService.rollbackSodTransaction(tx, order.id);
                                });
                            }
                        }));
                    }

                    totalUpdated += ordersToUpdate.length;
                }
            }

            // Update sync settings timestamp
            const latestStatusDate = filteredData.reduce((latest: Date, item: SLTPATData) => {
                const sDate = sltApiService.parseStatusDate(item.CON_STATUS_DATE);
                return sDate && sDate > latest ? sDate : latest;
            }, filterDate);

            await prisma.systemSetting.upsert({
                where: { key: 'LAST_HO_REJECTED_SYNC' },
                update: { value: latestStatusDate.toISOString() },
                create: { key: 'LAST_HO_REJECTED_SYNC', value: latestStatusDate.toISOString() }
            });

            const opmcs = await prisma.oPMC.findMany({ select: { id: true } });
            for (const opmc of opmcs) {
                const [queueErr] = await safe(addJob(statsUpdateQueue, `stats-${opmc.id}`, { opmcId: opmc.id, type: 'SINGLE_OPMC' }));
                if (queueErr) {
                    console.warn(`[PAT-SYNC] Failed to queue stats update for OPMC ${opmc.id} (Workers might be disabled):`, queueErr);
                }
            }

            return { totalCached, totalUpdated };
    }

    /**
     * Trigger sync for all OPMCs
     */
    static async syncAllOpmcs(offset: number = 0, limit: number = 15) {
        let opmcs = await prisma.oPMC.findMany({ select: { id: true, rtom: true }, orderBy: { rtom: 'asc' } });
        const totalOpmcs = opmcs.length;
        if (limit > 0) {
            opmcs = opmcs.slice(offset, offset + limit);
        }

        if (process.env.VERCEL === '1' || process.env.NODE_ENV === 'production') {
            console.log(`[SYNC] Syncing OPMCs batch ${offset} to ${offset + opmcs.length} of ${totalOpmcs}...`);
            let created = 0;
            let updated = 0;
            const results: Array<{ rtom: string; success: boolean; created?: number; updated?: number; error?: string }> = [];

            // ── Optimization: Pre-load all open SODs across every OPMC in one query ──
            // This eliminates 44 per-OPMC findMany queries for disappeared SOD detection.
            // PROV_CLOSED included per domain rule: stuck-in-PROV_CLOSED + portal drop-off = DISAPPEARED.
            const allOpmcIds = opmcs.map(o => o.id);
            const allPendingSods = await prisma.serviceOrder.findMany({
                where: {
                    opmcId: { in: allOpmcIds },
                    sltsStatus: { in: ['INPROGRESS', 'PROV_CLOSED'] },
                    isOfflineWorkOrder: false,
                    isManualEntry: false,
                    isLegacyImport: false
                },
                select: { id: true, soNum: true, sltsStatus: true, status: true, returnReason: true, comments: true, opmcId: true }
            });
            // Group by opmcId → O(P) build time, O(1) lookup per OPMC
            const pendingByOpmc = new Map<string, typeof allPendingSods>();
            for (const sod of allPendingSods) {
                const list = pendingByOpmc.get(sod.opmcId) || [];
                list.push(sod);
                pendingByOpmc.set(sod.opmcId, list);
            }

            const concurrencyLimit = 15;
            const startTime = Date.now();
            const maxAllowedTimeMs = 9500; // 9.5s deadline for Vercel Hobby 15s serverless cap

            for (let i = 0; i < opmcs.length; i += concurrencyLimit) {
                if (Date.now() - startTime > maxAllowedTimeMs) {
                    console.log(`[SYNC] Reached 9.5s Vercel serverless time limit threshold after processing ${results.length} OPMCs. Gracefully returning.`);
                    break;
                }
                const chunk = opmcs.slice(i, i + concurrencyLimit);
                const chunkResults = await Promise.all(chunk.map(async (opmc) => {
                    const localPendingSods = pendingByOpmc.get(opmc.id) || [];
                    const [e, res] = await safe(Promise.race([
                        this.syncServiceOrders(opmc.id, opmc.rtom, localPendingSods),
                        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('OPMC Sync Timeout')), 7500))
                    ]));
                    
                    if (e || !res) {
                        return { rtom: opmc.rtom, success: false, error: String(e) };
                    }
                    
                    return { rtom: opmc.rtom, success: true, created: res.created, updated: res.updated };
                }));

                for (const r of chunkResults) {
                    if (r.success) {
                        created += r.created || 0;
                        updated += r.updated || 0;
                        results.push({ rtom: r.rtom, success: true, created: r.created, updated: r.updated });
                    } else {
                        results.push({ rtom: r.rtom, success: false, error: r.error });
                    }
                }
            }

            // ── Self-healing guard: portal-confirmed install closures must advance the ERP
            // workflow status. Re-asserted every cycle so stragglers (legacy deployments,
            // race windows, out-of-band writes) cannot leave terminal SODs looking active.
            const healed = await prisma.serviceOrder.updateMany({
                where: {
                    sltsStatus: 'INSTALL_CLOSED',
                    status: {
                        in: ['PENDING', 'INPROGRESS', 'ASSIGNED', 'PROV_CLOSED'] as import("@prisma/client").ServiceOrderStatus[]
                    }
                },
                data: { status: 'INSTALL_CLOSED' }
            });
            if (healed.count > 0) {
                console.log(`[SYNC] Self-heal: advanced ${healed.count} INSTALL_CLOSED SODs with stale workflow status.`);
            }

            const stats = {
                queuedCount: 0,
                jobIds: [],
                lastSyncTriggered: new Date().toISOString(),
                created,
                updated,
                failed: results.filter(r => 'error' in r).length
            };

            await prisma.systemSetting.upsert({
                where: { key: 'LAST_SYNC_STATS' },
                update: { value: stats as unknown as Prisma.InputJsonValue },
                create: { key: 'LAST_SYNC_STATS', value: stats as unknown as Prisma.InputJsonValue }
            });

            return { success: true, method: 'synchronous', stats, results };
        }

        const jobs = await Promise.all(
            opmcs.map(opmc =>
                sodSyncQueue.add(`sync-${opmc.rtom}`, {
                    opmcId: opmc.id,
                    rtom: opmc.rtom
                }, {
                    jobId: `sync-${opmc.id}-${new Date().toISOString().split('T')[0]}-${Date.now()}`
                })
            )
        );

        const stats = {
            queuedCount: opmcs.length,
            jobIds: jobs.map((j) => String(j.id)),
            lastSyncTriggered: new Date().toISOString(),
            created: 0,
            updated: 0,
            failed: 0
        };

        await prisma.systemSetting.upsert({
            where: { key: 'LAST_SYNC_STATS' },
            update: { value: stats as unknown as Prisma.InputJsonValue },
            create: { key: 'LAST_SYNC_STATS', value: stats as unknown as Prisma.InputJsonValue }
        });

        return { success: true, stats };
    }

    /**
     * Update global sync stats from background jobs
     */
    static async updateGlobalSyncStats(incremental: { created?: number; updated?: number; failed?: number }) {
        await prisma.$transaction(async (tx) => {
            const current = await tx.systemSetting.findUnique({
                where: { key: 'LAST_SYNC_STATS' }
            });
            if (!current) return;
            const stats = current.value as unknown as SyncStats;
            await tx.systemSetting.update({
                where: { key: 'LAST_SYNC_STATS' },
                data: {
                    value: {
                        ...stats,
                        created: (stats.created || 0) + (incremental.created || 0),
                        updated: (stats.updated || 0) + (incremental.updated || 0),
                        failed: (stats.failed || 0) + (incremental.failed || 0)
                    }
                }
            });
        });
    }

    /**
     * Sync single OPMC Service Orders
     */
    static async syncServiceOrders(
        opmcId: UUID,
        rtom: string,
        preloadedPendingSods?: { id: UUID; soNum: string | null; sltsStatus: string; status: string; returnReason: string | null; comments: string | null; opmcId: UUID }[]
    ) {
        const sltData = await sltApiService.fetchServiceOrders(rtom);
        if (!sltData || sltData.length === 0) return { created: 0, updated: 0 };

        const configs = await SystemConfigService.getConfigs();
        const offlineOrderTypes = (configs['OFFLINE_ORDER_TYPES'] || 'MODIFY-LOCATION')
            .split(',')
            .map(s => s.trim().toUpperCase());

        const sltSoNums = sltData.map(item => item.SO_NUM);
        const existingSods = await prisma.serviceOrder.findMany({
            where: { soNum: { in: sltSoNums } },
            select: { id: true, soNum: true, sltsStatus: true, status: true, returnReason: true, comments: true, statusDate: true, contractorId: true, receivedDate: true }
        });
        const existingMap = new Map<string, { id: string; soNum: string; sltsStatus: string; status: string; returnReason: string | null; comments: string | null; statusDate: Date | null; contractorId: string | null; receivedDate: Date | null }>(
            existingSods.map(s => [s.soNum as string, s])
        );

        const uniqueSyncMap = new Map<string, SLTServiceOrderData>();
        sltData.forEach(item => {
            const existing = existingMap.get(item.SO_NUM);
            if (existing) {
                const incomingStatus = (item.CON_STATUS || '').toUpperCase().trim();
                const incomingMapped = SODLifecycleService.mapExternalStatusToSltsStatus(incomingStatus);
                const isIncomingTerminal = ['COMPLETED', 'INSTALL_CLOSED', 'DISAPPEARED'].includes(incomingMapped);
                const isExistingTerminal = ['COMPLETED', 'INSTALL_CLOSED', 'DISAPPEARED'].includes(existing.sltsStatus);
                // Only skip if both existing and incoming are terminal AND same status (allow INSTALL_CLOSED correction)
                if (isExistingTerminal && isIncomingTerminal && existing.sltsStatus === (incomingStatus === 'INSTALL_CLOSED' ? 'INSTALL_CLOSED' : incomingMapped)) return;
            }
            const currentInMap = uniqueSyncMap.get(item.SO_NUM);
            if (currentInMap && currentInMap.CON_STATUS === 'INSTALL_CLOSED') return;
            uniqueSyncMap.set(item.SO_NUM, item);
        });
        const syncableData = Array.from(uniqueSyncMap.values());

        let created = 0; let updated = 0;

        // ── Optimization: Collect new records in a batch, flush with createMany ──
        // Reduces O(N) individual DB round-trips to O(1) per OPMC
        const toCreate: Prisma.ServiceOrderUncheckedCreateInput[] = [];
        const toUpdate: { existing: { id: string; soNum?: string | null; status: string; sltsStatus: string; returnReason?: string | null; contractorId?: string | null; completedDate?: Date | null; receivedDate?: Date | null; comments?: string | null; completionMode?: string | null; rtom?: string | null; statusDate?: Date | null }, updatePayload: Prisma.ServiceOrderUncheckedUpdateInput, initialSltsStatus: string }[] = [];

        for (const item of syncableData) {
            const statusDate = sltApiService.parseStatusDate(item.CON_STATUS_DATE) || new Date();
            const cleanStatus = (item.CON_STATUS || '').toUpperCase().trim();
            const initialSltsStatus = SODLifecycleService.mapExternalStatusToSltsStatus(cleanStatus);
            const isInstallClosed = cleanStatus === 'INSTALL_CLOSED';
            const effectiveSltsStatus = isInstallClosed ? 'INSTALL_CLOSED' as const : initialSltsStatus;

            const isOfflineType = offlineOrderTypes.includes((item.ORDER_TYPE || '').toUpperCase());
            const isOfflineFlag = isOfflineType || cleanStatus === 'OFFLINE';

            const itemObj = item as unknown as Record<string, unknown>;
            const explicitContractor = (itemObj.CONTRACTOR_NAME as string | undefined) || (itemObj.CONTRACTOR as string | undefined) || (itemObj.CON_CONTRACTOR as string | undefined);
            const woroTaskName = item.CON_WORO_TASK_NAME ? String(item.CON_WORO_TASK_NAME).trim() : null;

            const isGenericTaskName = (name?: string | null) => {
                if (!name) return true;
                const u = name.trim().toUpperCase();
                if (u.includes('/')) return false;
                const genericPatterns = [
                    'CONSTRUCT_OSP', 'RECONSTRUCT_OSP', 'MODIFY-LOCATION', 'MODIFY_LOCATION',
                    'SERVICE_MODIFY', 'SERVICE-MODIFY', 'MAINTAIN_OSP', 'MAINTAIN-OSP',
                    'FAULT_REPAIR', 'CONSTRUCT', 'RECONSTRUCT', 'OSP', 'REPAIR',
                    'INSTALL', 'NEW_CONNECTION', 'UPGRADE', 'CHANGE_LOCATION', 'LOCATION_CHANGE'
                ];
                return genericPatterns.some(pattern => u === pattern || u.startsWith(pattern));
            };

            let portalTeamName: string | null = null;
            if (woroTaskName && woroTaskName.includes('/')) {
                portalTeamName = woroTaskName;
            } else if (explicitContractor && explicitContractor.trim()) {
                portalTeamName = explicitContractor.trim();
            } else if (woroTaskName && !isGenericTaskName(woroTaskName)) {
                portalTeamName = woroTaskName;
            }

            let contractorId: string | null = null;
            let teamId: string | null = null;

            if (portalTeamName) {
                const { ContractorLifecycleService } = await import('../contractor/contractor.lifecycle.service');
                const [resolvedErr, resolved] = await safe(ContractorLifecycleService.resolveTeamAndContractorByIShampTeamName(portalTeamName, opmcId));
                if (!resolvedErr && resolved) {
                    contractorId = resolved.contractorId;
                    teamId = resolved.teamId;
                }
            }

            const existing = existingMap.get(item.SO_NUM);

            // For returned SODs that are re-completed, CON_STATUS_DATE might be the original date
            // Use receivedDate (reactivation date) if it's later than CON_STATUS_DATE
            const effectiveCompletedDate = (initialSltsStatus === 'COMPLETED' || isInstallClosed)
                ? (existing?.receivedDate && statusDate < existing.receivedDate ? existing.receivedDate : statusDate)
                : undefined;

            const updatePayload: Prisma.ServiceOrderUncheckedUpdateInput = {
                lea: item.LEA,
                voiceNumber: item.VOICENUMBER,
                orderType: item.ORDER_TYPE,
                serviceType: item.S_TYPE,
                customerName: item.CON_CUS_NAME,
                techContact: item.CON_TEC_CONTACT,
                statusDate,
                address: item.ADDRE,
                dp: item.DP,
                package: item.PKG,
                woroTaskName: item.CON_WORO_TASK_NAME,
                iptv: item.IPTV,
                woroSeit: item.CON_WORO_SEIT,
                ftthInstSeit: item.FTTH_INST_SIET,
                ftthWifi: item.FTTH_WIFI,
                ospPhoneClass: item.CON_OSP_PHONE_CLASS,
                phonePurchase: item.CON_PHN_PURCH,
                sales: item.CON_SALES,
                completedDate: effectiveCompletedDate,
                sltsStatus: effectiveSltsStatus,
                // Advance ERP workflow status on INSTALL_CLOSED transitions — SODs created
                // without a contractor (status=PENDING) must not stay PENDING after portal install-close.
                // COMPLETED transitions stay untouched: completed-sod-sync owns PAT_* status refinement.
                status: effectiveSltsStatus === 'INSTALL_CLOSED' ? 'INSTALL_CLOSED' : undefined,
                isOfflineWorkOrder: isOfflineFlag ? true : undefined,
                contractorId: contractorId || undefined,
                teamId: teamId || undefined,
                directTeam: portalTeamName || undefined,
                returnReason: initialSltsStatus === 'RETURN' ? (existing?.returnReason || (item.CON_STATUS ? `Portal Return: ${item.CON_STATUS}` : 'Returned in external portal')) : undefined
            };

            if (existing) {
                toUpdate.push({ existing, updatePayload, initialSltsStatus: effectiveSltsStatus });
            } else {
                const isFinished = effectiveSltsStatus === 'COMPLETED' || effectiveSltsStatus === 'INSTALL_CLOSED';
                const isRecent = statusDate.getFullYear() >= 2026;
                if (!isFinished || isRecent) {
                    toCreate.push({
                        ...updatePayload,
                        opmcId,
                        contractorId: contractorId || null,
                        rtom: item.RTOM || rtom,
                        soNum: item.SO_NUM,
                        receivedDate: statusDate,
                        completedDate: (initialSltsStatus === 'COMPLETED' || isInstallClosed) ? statusDate : null,
                        sltsStatus: effectiveSltsStatus,
                        status: isInstallClosed ? 'INSTALL_CLOSED' : (contractorId ? 'INPROGRESS' : 'PENDING')
                    } as Prisma.ServiceOrderUncheckedCreateInput);
                }
            }
        }

        // Sequential Updates (Chunked)
        const updateChunks: (typeof toUpdate)[] = [];
        for (let i = 0; i < toUpdate.length; i += 20) {
            updateChunks.push(toUpdate.slice(i, i + 20));
        }

        for (const chunk of updateChunks) {
            await Promise.all(chunk.map(async ({ existing, updatePayload, initialSltsStatus }) => {
                // Track RETURN/restore transitions for material and ledger processing
                const isReturning = (initialSltsStatus === 'RETURN' && existing.sltsStatus !== 'RETURN');
                const isRestoring = (existing.sltsStatus === 'RETURN' && initialSltsStatus !== 'RETURN');
                const isStatusChange = updatePayload.sltsStatus && updatePayload.sltsStatus !== existing.sltsStatus;

                // Portal can reactivate a returned SOD (RETURN → INPROGRESS). Allow it.
                // But block RETURN → terminal status (COMPLETED/INSTALL_CLOSED) — those go through completed-sod-sync.
                if (isRestoring && ['COMPLETED', 'INSTALL_CLOSED'].includes(initialSltsStatus)) {
                    console.log(`[SYNC] Blocking RETURN→${initialSltsStatus} for ${existing.soNum}. Terminal transitions must go through completed-sod-sync.`);
                    return;
                }

                // When portal restores a RETURNED SOD to active status, clear return-specific fields
                if (isRestoring && initialSltsStatus === 'INPROGRESS') {
                    updatePayload.returnReason = null;
                    // Use portal's CON_STATUS_DATE (actual reactivation date), not sync run time
                    updatePayload.receivedDate = updatePayload.statusDate || new Date();
                    const restoreDate = updatePayload.statusDate ? new Date(updatePayload.statusDate as string).toLocaleDateString() : 'N/A';
                    const restoreComment = `[SYNC-RESTORED] Portal reactivated returned SOD (Reactivated: ${restoreDate})`;
                    updatePayload.comments = existing.comments ? `${existing.comments}\n${restoreComment}` : restoreComment;
                    console.log(`[SYNC] Restoring RETURNED SOD ${existing.soNum} to INPROGRESS (reactivated: ${restoreDate})`);
                }

                let blockStatusUpdate = false;

                if (isStatusChange) {
                    const { ProcessGateEngine } = await import('../approval/process-gate-engine');
                    try {
                        const gateResult = await ProcessGateEngine.startGate({
                            entityType: 'SOD',
                            entityId: existing.id,
                            currentStatus: existing.sltsStatus,
                            entityPayload: updatePayload as Record<string, unknown>
                        });

                        if (gateResult.status === 'GATE_STARTED') {
                            blockStatusUpdate = true;
                            console.log(`[SYNC] FSM Intercepted transition for ${existing.soNum}. Halting sync-driven status update.`);
                        }
                    } catch (gateErr: unknown) {
                        const errMsg = gateErr instanceof Error ? gateErr.message : String(gateErr);
                        console.warn(`[SYNC] FSM blocked transition for ${existing.soNum}:`, errMsg);
                        blockStatusUpdate = true;
                    }
                }

                if (blockStatusUpdate) {
                    delete updatePayload.sltsStatus;
                    delete updatePayload.completedDate;
                    delete updatePayload.status;
                }

                // ── Change detection: skip DB write if nothing meaningful changed ──
                // statusDate is the portal's last-modified timestamp. If it hasn't changed,
                // the SOD data is identical to last sync — skip the entire transaction.
                const incomingStatusDate = updatePayload.statusDate as Date | undefined;
                const existingStatusDate = existing.statusDate;
                const contractorChanged = updatePayload.contractorId !== undefined && updatePayload.contractorId !== existing.contractorId;
                
                if (!isStatusChange && !contractorChanged && incomingStatusDate && existingStatusDate) {
                    const incomingTime = incomingStatusDate.getTime();
                    const existingTime = new Date(existingStatusDate).getTime();
                    if (Math.abs(incomingTime - existingTime) < 1000) {
                        return; // statusDate unchanged, no status/contractor change → skip DB write
                    }
                }
                
                const [err] = await safe(prisma.$transaction(async (tx) => {
                    const updatedOrder = await tx.serviceOrder.update({
                        where: { id: existing.id },
                        data: {
                            ...updatePayload,
                            sltsStatus: updatePayload.sltsStatus as any
                        }
                    });

                    if (isReturning) {
                        await SODMaterialService.rollbackMaterialUsage(tx, existing.id, 'SYNC_SERVICE');
                        await LedgerService.rollbackSodTransaction(tx, existing.id);
                    }

                    // Audit trail: write status history + publish status-change event for sync-driven transitions
                    await SODLifecycleService.handlePostUpdate(
                        { status: existing.status, sltsStatus: existing.sltsStatus, statusDate: null },
                        updatedOrder,
                        updatePayload,
                        'SYNC_SERVICE',
                        tx
                    );
                }));

                if (err) {
                    console.error(`[SYNC] Failed to update existing SOD ${existing.soNum}:`, err);
                } else {
                    updated++;
                }
            }));
        }

        if (toCreate.length > 0) {
            const [createErr] = await safe(prisma.serviceOrder.createMany({ data: toCreate, skipDuplicates: true }));
            if (createErr) {
                console.error(`[SYNC] Failed to batch create SODs for ${rtom}:`, createErr);
            } else {
                created = toCreate.length;
            }
        }

        // ── Optimization: Use pre-loaded pending SODs instead of re-querying DB ──
        // When called from syncAllOpmcs, pendingSods are pre-loaded globally (O(1) lookup)
        // When called standalone, fall back to per-OPMC query
        const localPendingSods = preloadedPendingSods ?? await prisma.serviceOrder.findMany({
            where: {
                opmcId,
                // PROV_CLOSED included: a SOD stuck in PROV_CLOSED that drops off the portal
                // (connection lost before COMPLETED) is the DISAPPEARED case per domain rule
                sltsStatus: { in: ['INPROGRESS', 'PROV_CLOSED'] },
                isOfflineWorkOrder: false,
                isManualEntry: false,
                isLegacyImport: false
            },
            select: { id: true, soNum: true, sltsStatus: true, status: true, returnReason: true, comments: true }
        });

        const sltSoNumSet = new Set(sltSoNums);
        const disappearedSods = localPendingSods.filter(sod => sod.soNum && !sltSoNumSet.has(sod.soNum));

        if (disappearedSods.length > 0) {
            console.log(`[SYNC-DISAPPEARED] Found ${disappearedSods.length} disappeared SODs for RTOM: ${rtom}. Fetching external status...`);
            const today = new Date();
            // Fetch last 2 months of completed SODs to locate missing ones
            const startDate = format(subMonths(today, 2), 'yyyy-MM-dd');
            const endDate = format(today, 'yyyy-MM-dd');

            const [completedResults, rejectedResults, returnedResults] = await Promise.all([
                sltApiService.fetchCompletedSODs(rtom, startDate, endDate),
                sltApiService.fetchOpmcRejected(rtom),
                sltApiService.fetchReturnedSODs(rtom, startDate, endDate)
            ]);

            const externalStatusMap = new Map<string, { status: string; statusDate: string; rawItem?: unknown }>();

            completedResults.forEach(item => {
                externalStatusMap.set(item.SO_NUM, { status: item.CON_STATUS, statusDate: item.CON_STATUS_DATE, rawItem: item });
            });

            rejectedResults.forEach(item => {
                externalStatusMap.set(item.SO_NUM, { status: item.CON_STATUS, statusDate: item.CON_STATUS_DATE, rawItem: item });
            });

            returnedResults.forEach(item => {
                externalStatusMap.set(item.SO_NUM, { status: item.CON_STATUS, statusDate: item.CON_STATUS_DATE, rawItem: item });
            });

            for (const disappearedSod of disappearedSods) {
                const extStatus = externalStatusMap.get(disappearedSod.soNum || '');
                if (extStatus) {
                    const statusUpper = String(extStatus.status || '').toUpperCase();
                    const statusDate = sltApiService.parseStatusDate(extStatus.statusDate) || new Date();

                    // Canonical mapping: COMPLETED family, PROV_CLOSED, RETURN family
                    const rawItemObj = extStatus.rawItem as Record<string, unknown> | undefined;
                    const rawOrderType = (rawItemObj?.ORDER_TYPE as string | undefined) || '';
                    const isOfflineType = rawOrderType ? offlineOrderTypes.includes(rawOrderType.toUpperCase()) : false;

                    let nextSltsStatus: string = SODLifecycleService.mapExternalStatusToSltsStatus(statusUpper);
                    if (statusUpper === SodStatus.INSTALL_CLOSED) {
                        nextSltsStatus = SodStatus.INSTALL_CLOSED;
                    } else if (nextSltsStatus === 'INPROGRESS') {
                        // Found in completed/rejected lists with an unmapped status — treat as COMPLETED
                        // (PAT_OPMC_REJECTED etc. are work-order complete per domain rule)
                        nextSltsStatus = 'COMPLETED';
                    }

                    if (nextSltsStatus !== 'INPROGRESS') {
                        const [disError] = await safe(prisma.$transaction(async (tx) => {
                            const updatePayload: Prisma.ServiceOrderUncheckedUpdateInput = {
                                status: SERVICE_ORDER_STATUS_VALUES.has(statusUpper) ? statusUpper as import("@prisma/client").ServiceOrderStatus : (nextSltsStatus as import("@prisma/client").ServiceOrderStatus),
                                statusDate,
                                sltsStatus: nextSltsStatus as import("@prisma/client").ServiceOrderStatus,
                                completionMode: isOfflineType ? 'OFFLINE' : undefined,
                                completedDate: (nextSltsStatus === 'COMPLETED' || nextSltsStatus === 'INSTALL_CLOSED') ? statusDate : null,
                                returnReason: nextSltsStatus === 'RETURN' ? (disappearedSod.returnReason || (extStatus.status ? `Portal Returned: ${extStatus.status}` : 'Returned in external portal')) : undefined,
                                // Clear completion data for RETURN - connection did not complete successfully
                                ...(nextSltsStatus === 'RETURN' ? { revenueAmount: null, contractorAmount: null } : {}),
                                // Clear stale "[AUTO-SYNC] Disappeared" comment when recovering from DISAPPEARED
                                comments: null,
                            };

                            if (rawItemObj) {
                                const item = rawItemObj;
                                Object.assign(updatePayload, {
                                    lea: item.LEA || undefined,
                                    voiceNumber: item.VOICENUMBER || undefined,
                                    orderType: item.ORDER_TYPE || undefined,
                                    serviceType: item.S_TYPE || undefined,
                                    customerName: item.CON_CUS_NAME || undefined,
                                    techContact: item.CON_TEC_CONTACT || undefined,
                                    address: item.ADDRE || undefined,
                                    dp: item.DP || undefined,
                                    package: item.PKG || undefined,
                                    woroTaskName: item.CON_WORO_TASK_NAME || undefined,
                                    iptv: item.IPTV || undefined,
                                    woroSeit: item.CON_WORO_SEIT || undefined,
                                    ftthInstSeit: item.FTTH_INST_SIET || undefined,
                                    ftthWifi: item.FTTH_WIFI || undefined,
                                    ospPhoneClass: item.CON_OSP_PHONE_CLASS || undefined,
                                    phonePurchase: item.CON_PHN_PURCH || undefined,
                                    sales: item.CON_SALES || undefined
                                });
                            }

                            const updatedDisappeared = await tx.serviceOrder.update({
                                where: { id: disappearedSod.id },
                                data: updatePayload
                            });

                            if (nextSltsStatus === 'RETURN') {
                                await SODMaterialService.rollbackMaterialUsage(tx, disappearedSod.id, 'SYNC_SERVICE');
                                await LedgerService.rollbackSodTransaction(tx, disappearedSod.id);
                            }

                            // Audit trail: record disappeared-SOD status transition
                            await SODLifecycleService.handlePostUpdate(
                                { status: disappearedSod.status, sltsStatus: disappearedSod.sltsStatus, statusDate: null },
                                updatedDisappeared,
                                updatePayload,
                                'SYNC_SERVICE',
                                tx
                            );
                        }));
                        if (disError) {
                            console.error(`[SYNC-DISAPPEARED] Failed to process disappeared SOD ${disappearedSod.soNum}:`, disError);
                        } else {
                            updated++;
                        }
                    }
                } else {
                    // Disappeared and not found anywhere in completed or rejected -> mark as DISAPPEARED
                    console.log(`[SYNC-DISAPPEARED] SOD ${disappearedSod.soNum} not found in completed/rejected lists. Marking as DISAPPEARED.`);
                    const [disError] = await safe(prisma.$transaction(async (tx) => {
                        const markedDisappeared = await tx.serviceOrder.update({
                            where: { id: disappearedSod.id },
                            data: {
                                status: 'DISAPPEARED',
                                sltsStatus: 'DISAPPEARED',
                                returnReason: 'Missing from portal / Awaiting PROV_CLOSED processing',
                                // Clear stale completion data - DISAPPEARED means connection never completed
                                completedDate: null,
                                revenueAmount: null,
                                contractorAmount: null,
                                contractorId: null,
                                teamId: null,
                                // No auto-sync comments - preserve real user comments
                            }
                        });
                        // Material rollback for DISAPPEARED: clear any material usage records
                        await tx.sODMaterialUsage.deleteMany({
                            where: { serviceOrderId: disappearedSod.id }
                        });

                        // Audit trail: record DISAPPEARED transition
                        await SODLifecycleService.handlePostUpdate(
                            { status: disappearedSod.status, sltsStatus: disappearedSod.sltsStatus, statusDate: null },
                            markedDisappeared,
                            { statusDate: new Date() },
                            'SYNC_SERVICE',
                            tx
                        );
                    }));
                    if (disError) {
                        console.error(`[SYNC-DISAPPEARED] Failed to process disappeared SOD ${disappearedSod.soNum}:`, disError);
                    } else {
                        updated++;
                    }
                }
            }
        }

        if (created > 0 || updated > 0) {
            const [queueErr] = await safe(addJob(statsUpdateQueue, `stats-${opmcId}`, { opmcId, type: 'SINGLE_OPMC' }));
            if (queueErr) {
                console.warn(`[SYNC] Failed to queue stats update for OPMC ${opmcId} (Redis offline):`, queueErr);
            }
        }

        if (created > 0 || updated > 0) {
            const [err] = await safe((async () => {
                const { NotificationService } = await import('@/services/notification/notification.service');

                let title = `Service Orders Synced (${rtom})`;
                let message = '';
                if (created > 0 && updated > 0) {
                    message = `${created} new service orders were synced and ${updated} existing orders were updated for RTOM ${rtom}.`;
                } else if (created > 0) {
                    title = `New Service Orders Synced (${rtom})`;
                    message = `${created} new pending service orders were synced for RTOM ${rtom}.`;
                } else {
                    title = `Service Orders Updated (${rtom})`;
                    message = `${updated} existing service orders were updated for RTOM ${rtom}.`;
                }

                await NotificationService.notifyByRole({
                    roles: ROLE_GROUPS.SOD_PROJECT,
                    title,
                    message,
                    type: 'SYSTEM',
                    priority: 'MEDIUM',
                    link: `/service-orders?rtom=${encodeURIComponent(rtom)}&opmcId=${opmcId}`,
                    opmcId,
                    metadata: { count: created + updated, created, updated, opmcId, rtom }
                });
            })());
            if (err) {
                console.error('[SYNC-NOTIFY] Failed to broadcast SOD notifications:', err);
            }
        }

        return { created, updated };
    }

    /**
     * Parse scraped master details
     */
    // deepParse has been moved to SodUtils

    /**
     * Process bridge sync from chrome extension
     */
    static async bridgeSync(payload: {
        soNum?: string;
        allTabs?: Record<string, Record<string, string>>;
        teamDetails?: Record<string, string>;
        forensicAudit?: unknown[];
        materialDetails?: MaterialDetailInput[];
        currentUser?: string;
        activeTab?: string;
        url?: string;
        commentsList?: { date?: string; user?: string; comment?: string }[];
    }) {
        const { soNum, allTabs, teamDetails, forensicAudit } = payload;
        if (!soNum) return;
        const MATERIAL_MAP: Record<string, string> = {
            'DROP WIRE': 'OSPFTA003',
            'FTTH DROP WIRE': 'OSPFTA003',
            'D-WIRE': 'OSPFTA003',
            'DW': 'OSPFTA003',
            'ONT': 'ONT',
            'ONT ROUTER': 'ONT',
            'IPTV': 'IPTV-CPE',
            'STB': 'IPTV-CPE',
            'SET TOP BOX': 'IPTV-CPE',
            'PATCH CORD': 'OSPFTA004',
            'P-CORD': 'OSPFTA004',
            'OTO': 'OSPFTA005',
            'ROSETTE': 'OSPFTA005'
        };

        const masterData: Record<string, string> = {};
        if (allTabs) {
            Object.values(allTabs).forEach((tabData) => {
                if (tabData && typeof tabData === 'object') {
                    Object.assign(masterData, tabData);
                }
            });
        }

        const deepData = SodUtils.deepParse(masterData);

        // Scraper header-leak guard: the plain-text capture can grab an adjacent
        // portal label as the value (CIRCUIT -> 'STATUS', ORDER TYPE -> 'LINE TYPE').
        // Reject junk before it overwrites synced portal truth; a voice number must
        // carry digits, an order/service type must not be one of the portal labels.
        const HEADER_LABELS = new Set(['STATUS', 'LINE TYPE', 'ORDER TYPE', 'SERVICE TYPE', 'SERVICE', 'TYPE', 'TEST TYPE', 'RECEIVED DATE', 'STATUS DATE', 'STATUSDATE', 'CIRCUIT', 'VOICE NUMBER', 'VOICENUMBER', 'PRIMARY', 'LEA', 'RTOM', 'PACKAGE', 'TASK', 'CUSTOMER NAME', 'ADDRESS', 'CONTRACTOR', 'CONTACT NO', 'CONNECTION DETAIL']);
        const isPlausibleVoice = (v: unknown): v is string => typeof v === 'string' && /\d{7,}/.test(v.replace(/\s/g, ''));
        const isPlausibleLabel = (v: unknown): v is string => typeof v === 'string' && v.trim().length >= 2 && !HEADER_LABELS.has(v.trim().toUpperCase());

        const mapping: Partial<Prisma.ServiceOrderUncheckedUpdateInput> = {
            rtom: masterData['RTOM'] || masterData['CON_RTOM'] || deepData['RTOM'],
            lea: masterData['LEA'],
            voiceNumber: [masterData['VOICENUMBER'], masterData['CIRCUIT'], masterData['VOICE NUMBER'], deepData['CIRCUIT'], masterData['PRIMARY']].find(isPlausibleVoice),
            orderType: [masterData['ORDER_TYPE'], masterData['ORDER TYPE'], deepData['ORDER TYPE']].find(isPlausibleLabel),
            serviceType: [masterData['S_TYPE'], masterData['SERVICE TYPE'], masterData['SERVICE'], deepData['SERVICE']].find(isPlausibleLabel),
            customerName: masterData['CON_CUS_NAME'] || masterData['CUS_NAME'] || masterData['CUSTOMER NAME'] || deepData['CUSTOMER NAME'],
            techContact: masterData['CON_TEC_CONTACT'] || masterData['CONTACT NO'] || masterData['CONTACT NUMBER'] || deepData['CONTACT NO'],
            address: masterData['ADDRE'] || masterData['ADDRESS'] || deepData['ADDRESS'],
            package: masterData['PKG'] || masterData['PACKAGE'] || deepData['PACKAGE'],
            iptv: masterData['IPTV'],
            dpDetails: masterData['DP'] || masterData['DP LOOP'] || deepData['DP LOOP'] || masterData['DP_DETAILS'] || masterData['CONNECTION POINT (DP)'],
            sales: masterData['SALES PERSON'] || masterData['SALES'] || deepData['SALES PERSON'],
        };

        let ontVal = masterData['ONT_ROUTER_SERIAL_NUMBER'] || masterData['ONT_ROUTER_SERIAL_NUMBER_'] || masterData['ONT'] || masterData['SERIAL'];
        const iptvSerials: string[] = [];

        Object.entries(masterData).forEach(([k, v]) => {
            const key = k.toLowerCase();
            const val = String(v).trim();
            if (!val || val.length < 5) return;

            // Match exact or startsWith to avoid picking up long concatenated table headers
            if (!ontVal && (key.startsWith('ont_router_serial') || key === 'ont serial' || key === 'serial')) {
                ontVal = val;
            }
            if (key.includes('iptv_cpe_serial') || key.includes('stb_serial') || key === 'stb serial') {
                if (!iptvSerials.includes(val)) iptvSerials.push(val);
            }
        });

        if (ontVal) mapping.ontSerialNumber = ontVal;

        const serviceOrder = await prisma.serviceOrder.findUnique({
            where: { soNum },
            include: { materialUsage: true }
        });

        // ── SLT API Fallback: fill missing header fields from portal data ──
        // Bridge extension may only capture material/team data (plain text headers missed)
        const missingCriticalFields = (!mapping.rtom && !mapping.customerName && !mapping.address) ||
            !mapping.voiceNumber || !mapping.orderType;
        if (missingCriticalFields) {
            try {
                // Try to resolve RTOM from PAT status record first
                let fallbackRtom = serviceOrder?.rtom && serviceOrder.rtom !== 'UNKNOWN' ? serviceOrder.rtom : null;
                if (!fallbackRtom) {
                    const patRecord = await prisma.sLTPATStatus.findFirst({
                        where: { soNum },
                        select: { rtom: true }
                    });
                    fallbackRtom = patRecord?.rtom || null;
                }
                if (fallbackRtom) {
                    // Search active, completed, and returned SODs for this RTOM
                    // Use last 180 days for completed/returned queries
                    const now = new Date();
                    const startDate = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
                    const endDate = now.toISOString().split('T')[0];
                    const [activeData, completedData, returnedData] = await Promise.all([
                        sltApiService.fetchServiceOrders(fallbackRtom).catch(() => []),
                        sltApiService.fetchCompletedSODs(fallbackRtom, startDate, endDate).catch(() => []),
                        sltApiService.fetchReturnedSODs(fallbackRtom, startDate, endDate).catch(() => [])
                    ]);
                    const allPortalData = [...activeData, ...completedData, ...returnedData];
                    const portalMatch = allPortalData.find(r => r.SO_NUM === soNum);
                    if (portalMatch) {
                        if (!mapping.rtom && portalMatch.RTOM) mapping.rtom = portalMatch.RTOM;
                        if (!mapping.customerName && portalMatch.CON_CUS_NAME) mapping.customerName = portalMatch.CON_CUS_NAME;
                        if (!mapping.address && portalMatch.ADDRE) mapping.address = portalMatch.ADDRE;
                        if (!mapping.voiceNumber && portalMatch.VOICENUMBER) {
                            mapping.voiceNumber = portalMatch.VOICENUMBER;
                        }
                        if (!mapping.orderType && portalMatch.ORDER_TYPE) mapping.orderType = portalMatch.ORDER_TYPE;
                        if (!mapping.serviceType && portalMatch.S_TYPE) mapping.serviceType = portalMatch.S_TYPE;
                        if (!mapping.techContact && portalMatch.CON_TEC_CONTACT) mapping.techContact = portalMatch.CON_TEC_CONTACT;
                        if (!mapping.package && portalMatch.PKG) mapping.package = portalMatch.PKG;
                        if (!mapping.lea && portalMatch.LEA) mapping.lea = portalMatch.LEA;
                        console.log(`[bridgeSync] Filled missing header fields for ${soNum} from SLT API (RTOM: ${fallbackRtom})`);
                    }
                }
            } catch (e) {
                console.warn(`[bridgeSync] SLT API fallback failed for ${soNum}:`, (e as Error).message);
            }
        }

        const capturedContractorName = masterData['CON_NAME'] || masterData['CONTRACTOR'] || masterData['CONTRACTOR NAME'] || masterData['CONTRACTOR_NAME'];
        if (capturedContractorName && (!mapping.contractorId || mapping.contractorId === "")) {
            const contractor = await prisma.contractor.findFirst({
                where: { name: { contains: capturedContractorName.trim(), mode: 'insensitive' } }
            });
            if (contractor) mapping.contractorId = contractor.id;
        }

        const portalStatus = (masterData['CON_STATUS'] || masterData['STATUS'] || deepData['STATUS'] || '').toString().toUpperCase();

        const hasHiddenReturnFields =
            (masterData['RETREASON_HIDDEN'] && masterData['RETREASON_HIDDEN'].trim().length > 0) ||
            (masterData['RETCMT_HIDDEN'] && masterData['RETCMT_HIDDEN'].trim().length > 0);

        const isServiceReturn =
            masterData['SERVICE RETURN'] === 'on' ||
            masterData['IS_RETURN'] === 'on' ||
            masterData['CHKSODRTN_HIDDEN'] === 'on' ||
            masterData['CHKSODRTN'] === 'on' ||
            hasHiddenReturnFields ||
            portalStatus.includes('RETURN') ||
            portalStatus.includes('REJECT');

        if (isServiceReturn) {
            const rawReason = masterData['RETREASON_HIDDEN'] ||
                masterData['RTRESONALL_HIDDEN'] ||
                masterData['SOD RETURN'] ||
                masterData['RETURN REASON'] ||
                masterData['RETURNED REASON'] ||
                masterData['REASON'] ||
                masterData['rtresonall'] ||
                masterData['rt_reason'] ||
                portalStatus ||
                'NO OSP NW/PRIMARY/SECONDARY';

            const rawComment = masterData['RETCMT_HIDDEN'] ||
                masterData['RTCMTALL_HIDDEN'] ||
                masterData['RETURN COMMENT'] ||
                masterData['RETURNED COMMENT'] ||
                masterData['COMMENT'] ||
                masterData['rtcmtall'] ||
                masterData['rt_comment'] ||
                '';

            const classification = SODReturnClassifierService.classify(String(rawReason) + ' ' + String(rawComment));
            const formattedReason = String(rawReason).toUpperCase().trim();
            mapping.returnReason = formattedReason
                ? `${formattedReason} (${classification.category})`
                : classification.category;

            const combinedComment = `[AUTO_CAPTURED] Reason: ${rawReason}${rawComment ? ` | Comment: ${rawComment}` : ''}`;
            mapping.comments = serviceOrder?.comments
                ? (serviceOrder.comments.includes(combinedComment) ? serviceOrder.comments : `${serviceOrder.comments}\n${combinedComment}`)
                : combinedComment;

            if (!serviceOrder?.completedDate) mapping.completedDate = new Date();
        }

        const materialDetails = payload.materialDetails || [];
        const dropWireItem = materialDetails.find((m: MaterialDetailInput) => {
            const type = (m.TYPE || m.NAME || "").toUpperCase();
            return type && (type.includes('DROP WIRE') || type.includes('DWIRE') || type.includes('DW'));
        });

        if (dropWireItem && (dropWireItem.QTY !== undefined || dropWireItem.qty !== undefined)) {
            const qty = parseFloat(String(dropWireItem.QTY ?? dropWireItem.qty));
            if (!isNaN(qty)) mapping.dropWireDistance = qty;
        }

        let opmcId = serviceOrder?.opmcId;
        const rtomVal = (mapping.rtom as string) || (serviceOrder?.rtom);
        if (!opmcId && rtomVal) {
            // Use exact match on indexed rtom column first, then fallback to prefix contains
            const opmc = await prisma.oPMC.findFirst({
                where: { rtom: rtomVal.substring(0, 4) }
            }) || await prisma.oPMC.findFirst({
                where: { rtom: { contains: rtomVal.substring(0, 4), mode: 'insensitive' } }
            });
            opmcId = opmc?.id;
        }
        if (!opmcId) {
            // Use indexed rtom ordering instead of bare seq scan
            const firstOpmc = await prisma.oPMC.findFirst({ select: { id: true }, orderBy: { rtom: 'asc' } });
            opmcId = firstOpmc?.id || '';
        }

        const isOffline = (payload.url && payload.url.toLowerCase().includes('offline')) ||
            (masterData['COMPLETION_MODE'] && String(masterData['COMPLETION_MODE']).toUpperCase().includes('OFFLINE'));

        const dataToUpdate: Partial<Prisma.ServiceOrderUncheckedUpdateInput> = {
            ...mapping,
            completionMode: isOffline ? 'OFFLINE' : (mapping.completionMode || serviceOrder?.completionMode || 'Standard'),
            rtom: (mapping.rtom as string) || serviceOrder?.rtom || 'UNKNOWN',
            opmcId,
            updatedAt: new Date(),
        };

        const rcvDate = SodUtils.safeParseDate(masterData['RECEIVED DATE'] || SodUtils.deepParse(masterData)['RECEIVED DATE']);
        if (rcvDate) dataToUpdate.receivedDate = rcvDate;

        const stDate = SodUtils.safeParseDate(masterData['STATUS DATE'] || SodUtils.deepParse(masterData)['STATUS DATE']);
        if (stDate) dataToUpdate.statusDate = stDate;

        const statusStr = (masterData['CON_STATUS'] || masterData['STATUS'] || deepData['STATUS'] || '').toString();
        const currentStatus = statusStr.toUpperCase();

        const isCompletedStatus =
            [SodStatus.COMPLETED, 'INSTALL_CLOSED', 'PAT_OPMC_PASSED', 'PAT_PASSED', 'PAT_PASSED_OPMC'].includes(currentStatus);

        if (isCompletedStatus && !isServiceReturn) {
            dataToUpdate.sltsStatus = currentStatus === 'INSTALL_CLOSED' ? SodStatus.INSTALL_CLOSED : SodStatus.COMPLETED;
            // Keep status field in sync with sltsStatus (fixes display on completed/install-closed pages)
            if (currentStatus === 'INSTALL_CLOSED') {
                dataToUpdate.status = 'INSTALL_CLOSED';
            } else {
                dataToUpdate.status = 'COMPLETED';
            }

            // 1. Work Done Date (INSTALL_CLOSED Date - Physical Field Work Completion)
            let installDate = serviceOrder?.completedDate;
            if (!installDate) {
                installDate = SodUtils.safeParseDate(masterData['INSTALL_CLOSED_DATE'] || masterData['COMPLETED DATE'] || masterData['COMPLETED_DATE'] || stDate);
            }

            if (!installDate && Array.isArray(payload.commentsList)) {
                const completionLog = payload.commentsList.find(c => {
                    const commentText = String(c.comment || c.user || '').toLowerCase();
                    return commentText.includes('install closed') || commentText.includes('service order completed') || commentText.includes('completed');
                });
                if (completionLog && completionLog.date) {
                    const parsedLogDate = SodUtils.safeParseDate(completionLog.date);
                    if (parsedLogDate) {
                        installDate = parsedLogDate;
                    }
                }
            }

            dataToUpdate.completedDate = installDate || new Date();

            // 2. PAT Approval / OPMC System Completion Date (Caught by Extension)
            let patDate = SodUtils.safeParseDate(masterData['PAT_APPROVED_DATE'] || masterData['OPMC_PASSED_DATE'] || masterData['STATUS DATE'] || masterData['STATUS_DATE']);
            if (!patDate && Array.isArray(payload.commentsList)) {
                const patLog = payload.commentsList.find(c => {
                    const commentText = String(c.comment || c.user || '').toLowerCase();
                    return commentText.includes('pat') || commentText.includes('opmc') || commentText.includes('passed') || commentText.includes('approved');
                });
                if (patLog && patLog.date) {
                    const parsedPatDate = SodUtils.safeParseDate(patLog.date);
                    if (parsedPatDate) {
                        patDate = parsedPatDate;
                    }
                }
            }
            if (!patDate) patDate = new Date();

            // Store PAT System Completion Date explicitly
            if (['PAT_OPMC_PASSED', 'PAT_PASSED', 'PAT_PASSED_OPMC'].includes(currentStatus)) {
                dataToUpdate.opmcPatDate = patDate;
                dataToUpdate.sltsPatDate = patDate;
                dataToUpdate.opmcPatStatus = 'PASSED';
                dataToUpdate.sltsPatStatus = 'PASSED';
                dataToUpdate.patStatus = 'PAT_OPMC_PASSED';
            }
        } else if (isServiceReturn || (SOD_RETURN_STATUSES as readonly string[]).includes(currentStatus)) {
            dataToUpdate.sltsStatus = SodStatus.RETURN;
            const rawReason = masterData['RETURN REASON'] || masterData['REJECTION REASON'] || statusStr || 'Returned in external portal';
            const classification = SODReturnClassifierService.classify(rawReason);
            dataToUpdate.returnReason = classification.category;
            dataToUpdate.comments = serviceOrder?.comments
                ? `${serviceOrder.comments}\n[AI_CLASSIFIED] Reason: ${rawReason}`
                : `[AI_CLASSIFIED] Reason: ${rawReason}`;
            // Clear completion data - RETURN means connection did not complete successfully
            dataToUpdate.completedDate = null;
            dataToUpdate.revenueAmount = null;
            dataToUpdate.contractorAmount = null;
        } else if (currentStatus === 'ASSIGN' || currentStatus === 'ASSIGNED') {
            // Mirror the portal assignment flag verbatim - pending tables display it as ASSIGNED
            dataToUpdate.sltsStatus = SodStatus.ASSIGNED;
        }

        const teamName = (teamDetails?.['SELECTED TEAM'] || masterData['MOBILE_TEAM_DETAILS'] || masterData['TEAM_DETAILS'] || masterData['ASSIGNED_TEAM']) as string | undefined;
        if (teamName) {
            dataToUpdate.directTeam = teamName.trim();
            const teamCode = teamName.split('-')[0].trim();
            const team = await prisma.contractorTeam.findFirst({
                where: {
                    OR: [
                        { name: { contains: teamName.trim(), mode: 'insensitive' } },
                        { sltCode: teamCode.trim().toUpperCase() }
                    ]
                }
            });
            if (team) {
                dataToUpdate.teamId = team.id;
                dataToUpdate.contractorId = team.contractorId;
            }
        }

        const oldStatus = serviceOrder?.sltsStatus || null;
        let syncedOrder: ServiceOrder | null = null;

        if (serviceOrder) {
            const isReturning = (dataToUpdate.sltsStatus === 'RETURN' && oldStatus !== 'RETURN');
            const isCompleting = (dataToUpdate.sltsStatus === 'COMPLETED' && oldStatus !== 'COMPLETED');
            syncedOrder = await prisma.$transaction(async (tx) => {
                const updated = await tx.serviceOrder.update({
                    where: { id: serviceOrder.id },
                    data: dataToUpdate
                });

                if (iptvSerials.length > 0) {
                    const txClient = tx as unknown as { sODIptvSerial: { deleteMany: (args: unknown) => Promise<unknown>; createMany: (args: unknown) => Promise<unknown> } };
                    await txClient.sODIptvSerial.deleteMany({
                        where: { serviceOrderId: serviceOrder.id }
                    });
                    await txClient.sODIptvSerial.createMany({
                        data: iptvSerials.map(sn => ({
                            serviceOrderId: serviceOrder.id,
                            serialNumber: sn
                        }))
                    });
                }

                if (isReturning) {
                    await SODMaterialService.rollbackMaterialUsage(tx, serviceOrder.id, 'BRIDGE_SYNC');
                    await LedgerService.rollbackSodTransaction(tx, serviceOrder.id);
                }

                if (isCompleting || (updated.sltsStatus === SodStatus.COMPLETED && materialDetails.length > 0)) {
                    const usagesInput: MaterialUsageInput[] = [];
                    for (const mat of materialDetails) {
                        const code = mat.CODE || mat.TYPE;
                        const name = mat.NAME;
                        const qty = parseFloat(String(mat.QTY || "0"));

                        if (qty > 0 && (code || name)) {
                            const targetSource = updated.materialSource || serviceOrder.materialSource || 'SLT';
                            const targetType = (targetSource === 'SLTS' || targetSource === 'COMPANY') ? 'SLTS' : 'SLT';
                            // Normalized keys for exact-match against admin-managed alias arrays
                            const codeKey = code ? code.trim().toUpperCase() : "";
                            const nameKey = name ? name.trim().toUpperCase() : "";

                            // 1. Try finding item matching the SOD's materialSource type
                            let item = await tx.inventoryItem.findFirst({
                                where: {
                                    type: targetType,
                                    OR: [
                                        { code: code ? code.trim().toUpperCase() : undefined },
                                        { name: name ? { equals: name, mode: 'insensitive' } : undefined },
                                        { importAliases: { has: code || "" } },
                                        { importAliases: { has: name || "" } },
                                        { importAliases: { has: codeKey } },
                                        { importAliases: { has: nameKey } },
                                        { scrapedAliases: { has: codeKey } },
                                        { scrapedAliases: { has: nameKey } },
                                        { bomAliases: { has: codeKey } },
                                        { bomAliases: { has: nameKey } }
                                    ]
                                }
                            });

                            // 2. Fallback to any item type if specific type match is missing
                            if (!item) {
                                item = await tx.inventoryItem.findFirst({
                                    where: {
                                        OR: [
                                            { code: code ? code.trim().toUpperCase() : undefined },
                                            { name: name ? { equals: name, mode: 'insensitive' } : undefined },
                                            { importAliases: { has: code || "" } },
                                            { importAliases: { has: name || "" } },
                                            { importAliases: { has: codeKey } },
                                            { importAliases: { has: nameKey } },
                                            { scrapedAliases: { has: codeKey } },
                                            { scrapedAliases: { has: nameKey } },
                                            { bomAliases: { has: codeKey } },
                                            { bomAliases: { has: nameKey } }
                                        ]
                                    }
                                });
                            }

                            if (!item) {
                                const searchKey = (name || code || "").toUpperCase();
                                let mappedCode = null;
                                for (const [key, val] of Object.entries(MATERIAL_MAP)) {
                                    if (searchKey.includes(key)) { mappedCode = val; break; }
                                }
                                if (mappedCode) {
                                    item = await tx.inventoryItem.findFirst({ where: { code: mappedCode, type: targetType } }) ||
                                           await tx.inventoryItem.findFirst({ where: { code: mappedCode } });
                                }
                            }

                            // 4. Portal sends a single code, but the same physical material exists as
                            //    separate SLT / SLTS items with different codes. If the matched item's
                            //    type mismatches the SOD's materialSource, swap to the correct type
                            //    variant sharing the same commonName group — only when the contractor
                            //    actually holds stock of the variant (prevents negative-stock deductions).
                            if (item && item.type !== targetType) {
                                const groupName = item.commonName || item.name;
                                const typeVariant = await tx.inventoryItem.findFirst({
                                    where: {
                                        type: targetType,
                                        OR: [
                                            { commonName: groupName },
                                            { name: { equals: groupName, mode: 'insensitive' } }
                                        ]
                                    }
                                });
                                if (typeVariant) {
                                    if (updated.contractorId) {
                                        const variantStock = await tx.contractorStock.findUnique({
                                            where: { contractorId_itemId: { contractorId: updated.contractorId, itemId: typeVariant.id } }
                                        });
                                        if (variantStock && Number(variantStock.quantity) >= qty) {
                                            item = typeVariant;
                                        }
                                    } else {
                                        item = typeVariant;
                                    }
                                }
                            }

                            const matSerial = mat.SERIAL || (mat.RAW ? (mat.RAW['SERIAL'] || mat.RAW['SERIAL NUMBER'] || mat.RAW['ONT_ROUTER_SERIAL_NUMBER_']) : null);
                            if (item) {
                                usagesInput.push({
                                    itemId: item.id,
                                    quantity: qty.toString(),
                                    usageType: 'PORTAL_SYNC',
                                    serialNumber: matSerial || undefined,
                                    comment: `Auto-synced from Portal`
                                });
                            }
                        }
                    }

                    if (usagesInput.length > 0) {
                        try {
                            const { InventoryService } = await import('../inventory');
                            await SODMaterialService.processMaterialUsage(
                                tx,
                                updated.id,
                                updated.opmcId,
                                updated.contractorId,
                                usagesInput,
                                InventoryService,
                                payload.currentUser || 'BRIDGE_SYNC'
                            );

                            const updatedWithUsages = await tx.serviceOrder.findUnique({
                                where: { id: updated.id },
                                include: { materialUsage: true }
                            });
                            const usages = updatedWithUsages?.materialUsage || [];
                            const totalSodMaterialCost = usages.reduce((sum, u) => sum.add(new Prisma.Decimal(u.costPrice || 0).mul(new Prisma.Decimal(u.quantity))), new Prisma.Decimal(0));
                            await LedgerService.logSodConsumption(tx, updated.id, totalSodMaterialCost.toNumber());
                        } catch (matErr) {
                            console.warn('[BRIDGE-SYNC] Material processing skipped due to error:', matErr instanceof Error ? matErr.message : matErr);
                        }
                    }

                    if (updated.revenueAmount) {
                        await LedgerService.logSodRevenue(tx, updated.id, Number(updated.revenueAmount));
                    }
                }

                return updated;
            }, {
                timeout: 20000
            });
        } else {
            syncedOrder = await (prisma.serviceOrder as unknown as { create: (args: { data: unknown }) => Promise<import('@prisma/client').ServiceOrder> }).create({
                data: {
                    ...dataToUpdate,
                    soNum: soNum || "",
                    status: 'PENDING',
                    sltsStatus: (dataToUpdate.sltsStatus as string) || 'INPROGRESS',
                    iptvSerials: iptvSerials.length > 0 ? {
                        create: iptvSerials.map(sn => ({ serialNumber: sn }))
                    } : undefined
                }
            });
        }

        // Sync comments list to ServiceOrderComment table if present in payload
        const payloadRecord = payload as Record<string, unknown>;
        const rawHistory = (payloadRecord.history as Array<Record<string, unknown>> | undefined) || [];
        const commentsList = (payload.commentsList as Array<Record<string, unknown>> | undefined) || rawHistory;
        if (syncedOrder && commentsList.length > 0) {
            const [commentErr] = await safe((async () => {
                for (const cItem of commentsList) {
                    const c = cItem as Record<string, unknown>;
                    const dateStr = (c.date || c.DATE || c.TIME) as string | undefined;
                    const parsedDate = dateStr ? new Date(dateStr) : new Date();
                    const userStr = (c.user || c.USER || c.NAME || c['UPDATED BY'] || 'Unknown') as string;
                    const commentStr = (c.comment || c.REMARKS || c.COMMENT || c.STATUS || '') as string;
                    if (!commentStr) continue;
                    const formattedComment = `[Portal Comment by ${userStr}]: ${commentStr}`;

                    const existingComment = await prisma.serviceOrderComment.findFirst({
                        where: {
                            serviceOrderId: syncedOrder.id,
                            comment: formattedComment
                        }
                    });

                    if (!existingComment) {
                        await prisma.serviceOrderComment.create({
                            data: {
                                serviceOrderId: syncedOrder.id,
                                comment: formattedComment,
                                createdAt: isNaN(parsedDate.getTime()) ? new Date() : parsedDate
                            }
                        });
                    }
                }
            })());
            if (commentErr) {
                console.error('[BRIDGE-SYNC] Failed to sync comments history:', commentErr);
            }
        }

        if (syncedOrder && syncedOrder.sltsStatus !== oldStatus) {
            await safe((async () => {
                const { StatsService } = await import('@/lib/stats.service');
                await StatsService.handleStatusChange(syncedOrder.opmcId, oldStatus, syncedOrder.sltsStatus);

                if (syncedOrder.sltsStatus === 'RETURN') {
                    const { NotificationService } = await import('@/services/notification/notification.service');
                    await NotificationService.notifyByRole({
                        roles: ROLE_GROUPS.PROJECT_MANAGERS,
                        title: 'SOD Returned (Bridge Sync)',
                        message: `Service Order ${syncedOrder.soNum} was marked as RETURN via Extension. Reason: ${mapping.returnReason || 'N/A'}.`,
                        type: 'PROJECT',
                        priority: 'HIGH',
                        link: '/service-orders/work-order/return',
                        opmcId: syncedOrder.opmcId,
                        metadata: { soNum: syncedOrder.soNum, id: syncedOrder.id, opmcId: syncedOrder.opmcId }
                    });
                }
            })());
        }

        const voiceStatus = masterData['VOICE_TEST_RESULT'] || masterData['VOICE TEST'] || null;

        let finalForensicAudit = forensicAudit || [];
        if (!finalForensicAudit || finalForensicAudit.length === 0) {
            const extractedAudit = [];
            for (let i = 1; i <= 50; i++) {
                const name = masterData[`${i}IMGDN_HIDDEN`];
                const uuid = masterData[`${i}IMGN_HIDDEN`];
                if (name) {
                    extractedAudit.push({
                        name: name,
                        status: uuid ? 'OK' : 'MISSING',
                        uuid: uuid || undefined
                    });
                }
            }
            if (extractedAudit.length > 0) {
                finalForensicAudit = extractedAudit;
            }
        }

        if (finalForensicAudit && finalForensicAudit.length > 0 && soNum) {
            await prisma.sODForensicAudit.upsert({
                where: { soNum },
                update: { auditData: finalForensicAudit as Prisma.InputJsonValue, voiceTestStatus: voiceStatus, updatedAt: new Date() },
                create: { soNum, auditData: finalForensicAudit as Prisma.InputJsonValue, voiceTestStatus: voiceStatus }
            });
        }

        if (materialDetails.length > 0 && syncedOrder && syncedOrder.sltsStatus !== 'COMPLETED') {
            await prisma.sODMaterialUsage.deleteMany({
                where: { serviceOrderId: syncedOrder.id, usageType: 'PORTAL_SYNC' }
            });

            for (const mat of materialDetails) {
                const code = mat.CODE || mat.TYPE;
                const name = mat.NAME;
                const qty = parseFloat(String(mat.QTY || "0"));

                if (qty > 0 && (code || name)) {
                    const targetSource = syncedOrder.materialSource || 'SLT';
                    const targetType = (targetSource === 'SLTS' || targetSource === 'COMPANY') ? 'SLTS' : 'SLT';
                    // Normalized keys for exact-match against admin-managed alias arrays
                    const codeKey = code ? code.trim().toUpperCase() : "";
                    const nameKey = name ? name.trim().toUpperCase() : "";

                    let item = await prisma.inventoryItem.findFirst({
                        where: {
                            type: targetType,
                            OR: [
                                { code: code ? code.trim().toUpperCase() : undefined },
                                { name: name ? { equals: name, mode: 'insensitive' } : undefined },
                                { importAliases: { has: code || "" } },
                                { importAliases: { has: name || "" } },
                                { importAliases: { has: codeKey } },
                                { importAliases: { has: nameKey } },
                                { scrapedAliases: { has: codeKey } },
                                { scrapedAliases: { has: nameKey } },
                                { bomAliases: { has: codeKey } },
                                { bomAliases: { has: nameKey } }
                            ]
                        }
                    });

                    if (!item) {
                        item = await prisma.inventoryItem.findFirst({
                            where: {
                                OR: [
                                    { code: code ? code.trim().toUpperCase() : undefined },
                                    { name: name ? { equals: name, mode: 'insensitive' } : undefined },
                                    { importAliases: { has: code || "" } },
                                    { importAliases: { has: name || "" } },
                                    { importAliases: { has: codeKey } },
                                    { importAliases: { has: nameKey } },
                                    { scrapedAliases: { has: codeKey } },
                                    { scrapedAliases: { has: nameKey } },
                                    { bomAliases: { has: codeKey } },
                                    { bomAliases: { has: nameKey } }
                                ]
                            }
                        });
                    }

                    if (!item) {
                        const searchKey = (name || code || "").toUpperCase();
                        let mappedCode = null;
                        for (const [key, val] of Object.entries(MATERIAL_MAP)) {
                            if (searchKey.includes(key)) { mappedCode = val; break; }
                        }
                        if (mappedCode) {
                            item = await prisma.inventoryItem.findFirst({ where: { code: mappedCode, type: targetType } }) ||
                                   await prisma.inventoryItem.findFirst({ where: { code: mappedCode } });
                        }
                    }

                    // Portal sends a single code; resolve to the SLT/SLTS type variant
                    // sharing the same commonName group when types mismatch — only when
                    // the contractor actually holds stock of the variant (prevents
                    // negative-stock deductions once the SOD completes).
                    if (item && item.type !== targetType) {
                        const groupName = item.commonName || item.name;
                        const typeVariant = await prisma.inventoryItem.findFirst({
                            where: {
                                type: targetType,
                                OR: [
                                    { commonName: groupName },
                                    { name: { equals: groupName, mode: 'insensitive' } }
                                ]
                            }
                        });
                        if (typeVariant) {
                            if (syncedOrder.contractorId) {
                                const variantStock = await prisma.contractorStock.findUnique({
                                    where: { contractorId_itemId: { contractorId: syncedOrder.contractorId, itemId: typeVariant.id } }
                                });
                                if (variantStock && Number(variantStock.quantity) >= qty) {
                                    item = typeVariant;
                                }
                            } else {
                                item = typeVariant;
                            }
                        }
                    }

                    const matSerial = mat.SERIAL || (mat.RAW ? (mat.RAW['SERIAL'] || mat.RAW['SERIAL NUMBER'] || mat.RAW['ONT_ROUTER_SERIAL_NUMBER_']) : null);
                    if (item) {
                        await prisma.sODMaterialUsage.create({
                            data: {
                                serviceOrderId: syncedOrder.id,
                                itemId: item.id,
                                quantity: qty,
                                unit: item.unit || "Nos",
                                usageType: 'PORTAL_SYNC',
                                serialNumber: matSerial || null,
                                unitPrice: item.unitPrice ? Number(item.unitPrice) : 0,
                                costPrice: item.costPrice ? Number(item.costPrice) : 0,
                                comment: `Auto-synced from Portal`
                            }
                        });
                    }
                }
            }
        }

        await safe((async () => {
            if (soNum) {
                const existing = await prisma.extensionRawData.findFirst({
                    where: { soNum }
                });
                if (existing) {
                    await prisma.extensionRawData.update({
                        where: { id: existing.id },
                        data: {
                            sltUser: payload.currentUser || null,
                            activeTab: payload.activeTab || 'SYNC_PUSH',
                            url: payload.url || null,
                            scrapedData: payload as unknown as Prisma.InputJsonValue,
                            updatedAt: new Date()
                        }
                    });
                } else {
                    await prisma.extensionRawData.create({
                        data: {
                            soNum,
                            sltUser: payload.currentUser || null,
                            activeTab: payload.activeTab || 'SYNC_PUSH',
                            url: payload.url || null,
                            scrapedData: payload as unknown as Prisma.InputJsonValue
                        }
                    });
                }
            }
        })());

        return {
            success: true,
            id: syncedOrder?.id,
            soNum: syncedOrder?.soNum,
            message: 'Bridge sync successful.'
        };
    }
}
