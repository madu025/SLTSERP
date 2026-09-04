import { ROLE_GROUPS } from '@/config/roles';
import { prisma } from '@/lib/prisma';
import { AppError } from '@/lib/error';
import { Prisma, ServiceOrder, ServiceOrderStatus } from '@prisma/client';
import { sltApiService, SLTServiceOrderData, SLTPATData } from '@/services/slt/slt-api.service';
import { addJob, statsUpdateQueue, sodSyncQueue, systemQueue } from '../../lib/queue';
import { UUID } from '@/types/common';
import { SODMaterialService } from './sod.material.service';
import { LedgerService } from '../finance/ledger.service';
import { SODReturnClassifierService } from './sod-return-classifier.service';
import { SODLifecycleService, SERVICE_ORDER_STATUS_VALUES } from './sod.lifecycle.service';
import { SodUtils } from './sod.utils';
import { SystemConfigService } from '@/services/core/system-config.service';
import { SodStatus, SOD_RETURN_STATUSES, backfillReceiptDate, orderRaiseDateFromSoNum } from '@/lib/constants/sod-constants';
import { MaterialUsageInput } from '@/types/service-order/sod-sync.types';
import { format, subMonths } from 'date-fns';
import { safe } from '@/utils/safe-await.util';
import { enqueueCronJob } from '@/lib/cron-enqueue';
import {
    claimSlot,
    readSweepCursor,
    releaseSlot,
    releaseTickLock,
    tryAcquireTickLock,
    writeSweepCursor,
    type SlotPlan,
} from '@/lib/scheduler-state';

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
    /** Per-RTOM live-worklist refresh window - equals the external scheduler's tick interval. */
    static readonly RTOM_SWEEP_WINDOW_MS = 10 * 60 * 1000;
    /** Deterministic job-id prefix so multi-instance seeding dedupes instead of doubling portal calls. */
    static readonly RTOM_SWEEP_JOB_PREFIX = 'rtom-sweep';
    /** Asia/Colombo is UTC+5:30 all year (no DST) - same assumption as lib/timezone. */
    private static readonly SL_OFFSET_MS = 330 * 60 * 1000;

    /** RTOMs swept in parallel per inline chunk; the queue path staggers instead of batching. */
    private static readonly RTOM_INLINE_CONCURRENCY = 10;
    /** Per-RTOM inline ceiling - one wedged portal call must not eat the whole tick budget. */
    private static readonly RTOM_INLINE_TIMEOUT_MS = 15000;
    /** Tick lease lifetime; a function killed mid-tick unblocks the next tick after this. */
    private static readonly TICK_LEASE_MS = 9 * 60 * 1000;

    /**
     * Work that is due less often than the tick. There is exactly ONE external scheduler in this
     * deployment (cron-job.org, every 10 minutes, 24h) and no BullMQ repeatables, so a sub-cadence
     * is expressed as a bucket-aligned job id: `tick-<TYPE>-<bucket>` is identical for every tick
     * that falls inside the same bucket, and the queue rejects the duplicate. 20/30-minute work
     * therefore still runs 20/30-minute-ly without a second clock.
     */
    private static readonly TICK_BUCKET_JOBS: ReadonlyArray<{
        name: string;
        type: 'PERIODIC_COMPLETED_SYNC' | 'PERIODIC_GLOBAL_SYNC' | 'PERIODIC_RETURN_SYNC';
        everyMs: number;
    }> = [
            { name: 'periodic-completed-sync', type: 'PERIODIC_COMPLETED_SYNC', everyMs: 20 * 60 * 1000 },
            { name: 'periodic-global-sync', type: 'PERIODIC_GLOBAL_SYNC', everyMs: 30 * 60 * 1000 },
            { name: 'periodic-return-sync', type: 'PERIODIC_RETURN_SYNC', everyMs: 30 * 60 * 1000 },
        ];

    /**
     * Wall-clock dailies (Asia/Colombo), keyed on the SL date so each calendar day is seeded once.
     * A tick that arrives after the scheduled minute reuses the same job id, so a worker that was
     * down across the close still catches up instead of silently skipping the day.
     *
     * Former cadences are preserved 1:1: report close 00:15 SL, appointment sweep 05:45 SL (was
     * Vercel 00:00 UTC), daily automation 06:30 SL (was a tz-less BullMQ pattern `0 1 * * *`, which
     * the UTC container resolved as 01:00 UTC), notification cleanup Sun 02:00 SL (was the weekly
     * cron-job.org entry at 02:00 Asia/Colombo on weekday 0).
     */
    private static readonly TICK_DAILY_JOBS: ReadonlyArray<{
        name: string;
        type: 'DAILY_REPORT_SNAPSHOT' | 'APPOINTMENT_REMINDERS' | 'DAILY_AUTOMATION' | 'NOTIFICATION_CLEANUP';
        at: string;
        onlyOn?: number;
    }> = [
            { name: 'daily-report-snapshot', type: 'DAILY_REPORT_SNAPSHOT', at: '00:15' },
            { name: 'appointment-reminders', type: 'APPOINTMENT_REMINDERS', at: '05:45' },
            { name: 'daily-automation', type: 'DAILY_AUTOMATION', at: '06:30' },
            { name: 'notification-cleanup', type: 'NOTIFICATION_CLEANUP', at: '02:00', onlyOn: 0 },
        ];

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
     * Trigger sync for all OPMCs - enqueue only.
     *
     * The background worker does the work. The old inline path (9.5s budget, 7.5s per-OPMC
     * race, 15-OPMC slice) was built for a 15s serverless function, but one RTOM sync measures
     * 7-13s of portal + DB time, so most rows in a chunk died on 'OPMC Sync Timeout' and every
     * rank outside the slice went stale. Queueing per RTOM gives each one its own attempt
     * budget and BullMQ retry instead of a shared stopwatch.
     */
    static async syncAllOpmcs(offset: number = 0, limit: number = 15) {
        let opmcs = await prisma.oPMC.findMany({ select: { id: true, rtom: true }, orderBy: { rtom: 'asc' } });
        const totalOpmcs = opmcs.length;
        if (limit > 0) {
            opmcs = opmcs.slice(offset, offset + limit);
        }

        const dayKey = format(new Date(), 'yyyy-MM-dd');
        const jobs = await Promise.all(
            opmcs.map(async (opmc) => {
                const jobId = `sync-${opmc.id}-${dayKey}-${Date.now()}`;
                const job = await sodSyncQueue.add(`sync-${opmc.rtom}`, {
                    opmcId: opmc.id,
                    rtom: opmc.rtom
                }, { jobId });
                // The queue provider hands back a generated fallback id when Redis is down, so
                // echoing our own jobId is the only proof the job was actually persisted.
                return { rtom: opmc.rtom, jobId, accepted: String(job.id) === jobId };
            })
        );

        const lost = jobs.filter(j => !j.accepted);
        if (lost.length > 0) {
            console.error(`[SYNC] Queue accepted ${jobs.length - lost.length}/${jobs.length} jobs - ${lost.length} lost (Redis unavailable?). Background sync is NOT running.`);
        }

        // ── Self-healing guard: portal-confirmed install closures must advance the ERP
        // workflow status. Re-asserted every cycle so stragglers (legacy deployments,
        // race windows, out-of-band writes) cannot leave terminal SODs looking active.
        await this.selfHealTerminalStatuses();

        const stats = {
            queuedCount: jobs.length - lost.length,
            jobIds: jobs.filter(j => j.accepted).map(j => j.jobId),
            lastSyncTriggered: new Date().toISOString(),
            created: 0,
            updated: 0,
            failed: lost.length
        };

        await prisma.systemSetting.upsert({
            where: { key: 'LAST_SYNC_STATS' },
            update: { value: stats as unknown as Prisma.InputJsonValue },
            create: { key: 'LAST_SYNC_STATS', value: stats as unknown as Prisma.InputJsonValue }
        });

        console.log(`[SYNC] Enqueued ${stats.queuedCount}/${totalOpmcs} OPMC sync jobs (offset=${offset}, limit=${limit}).`);
        return { success: lost.length === 0, method: 'queued', stats };
    }

    /**
     * Repair stale ERP workflow statuses on portal-confirmed rows. Idempotent and indexed on
     * sltsStatus, so it is safe to re-assert from any sync tick.
     *
     * Two directions are healed:
     *  - terminal sltsStatus (INSTALL_CLOSED / RETURN) still showing an active workflow status;
     *  - a row previously marked DISAPPEARED that came back on the portal worklist: the sync
     *    refreshes sltsStatus (the effective routing field) but leaves `status` stuck, which is
     *    what made 0112458844 read DISAPPEARED in the UI while the portal said PROV_CLOSED.
     */
    static async selfHealTerminalStatuses(): Promise<{ installClosed: number; returned: number; restored: number }> {
        const staleStatuses = ['PENDING', 'INPROGRESS', 'ASSIGNED', 'PROV_CLOSED'] as import("@prisma/client").ServiceOrderStatus[];

        const healed = await prisma.serviceOrder.updateMany({
            where: { sltsStatus: 'INSTALL_CLOSED', status: { in: staleStatuses } },
            data: { status: 'INSTALL_CLOSED' }
        });
        if (healed.count > 0) {
            console.log(`[SYNC] Self-heal: advanced ${healed.count} INSTALL_CLOSED SODs with stale workflow status.`);
        }

        // RETURN rows are terminal too. A stale workflow status (PENDING/INPROGRESS/...)
        // leaves the detail modal showing an active-looking status on a returned SOD.
        const healedReturns = await prisma.serviceOrder.updateMany({
            where: { sltsStatus: 'RETURN', status: { in: staleStatuses } },
            data: { status: 'RETURN' }
        });
        if (healedReturns.count > 0) {
            console.log(`[SYNC] Self-heal: advanced ${healedReturns.count} RETURN SODs with stale workflow status.`);
        }

        // Reappeared rows: workflow status stuck on DISAPPEARED although the portal feed put a
        // different live status on the row. Grouped by target status so each write stays typed
        // (never a raw enum cast) and one updateMany covers each group.
        const stuckDisappeared = await prisma.serviceOrder.findMany({
            where: { status: 'DISAPPEARED', sltsStatus: { not: 'DISAPPEARED' } },
            select: { id: true, soNum: true, sltsStatus: true }
        });
        let restored = 0;
        if (stuckDisappeared.length > 0) {
            const idsByStatus = new Map<ServiceOrderStatus, string[]>();
            for (const row of stuckDisappeared) {
                if (!SERVICE_ORDER_STATUS_VALUES.has(row.sltsStatus)) continue;
                const target = row.sltsStatus as ServiceOrderStatus;
                const ids = idsByStatus.get(target) || [];
                ids.push(row.id);
                idsByStatus.set(target, ids);
            }
            for (const [target, ids] of idsByStatus) {
                const done = await prisma.serviceOrder.updateMany({ where: { id: { in: ids } }, data: { status: target } });
                restored += done.count;
            }
            const healedNums = stuckDisappeared.map((r) => r.soNum).filter(Boolean).slice(0, 15);
            console.log(`[SYNC] Self-heal: restored ${restored} reappeared SODs stuck on DISAPPEARED workflow status (${healedNums.join(', ')}).`);
        }

        return { installClosed: healed.count, returned: healedReturns.count, restored };
    }

    /**
     * Capture the portal's raw RETURNED_REASON / RETURNED_COMMENT for RETURN SODs.
     * The ishamp RETURNED_SLTS mirror carries the actual SLT return reason and the
     * free-text comment (e.g. "OSS DATA ERROR - LEA Changed (HC)") that CON_STATUS-only
     * views never expose — previously OTHER returns arrived with no explanation.
     * Time-budgeted: enriches a rotating subset of RTOMs per call; pass a large
     * maxRtoms for a full backfill.
     */
    static async syncReturnReasons(maxRtoms: number = 4): Promise<{ updated: number; checked: number }> {
        const returnRows = await prisma.serviceOrder.findMany({
            where: { sltsStatus: 'RETURN' },
            select: { id: true, soNum: true, rtom: true, returnReason: true, comments: true },
        });

        // Only touch rows still carrying bare classifier output or portal placeholders —
        // never downgrade richer reasons captured via the extension.
        const needsEnrichment = (reason: string | null): boolean =>
            !reason || /^[A-Z_]+$/.test(reason.trim()) || reason.startsWith('Portal Return') || reason.startsWith('Portal Returned');
        const byRtom = new Map<string, { id: string; soNum: string; returnReason: string | null; comments: string | null }[]>();
        for (const row of returnRows) {
            if (!row.soNum || !row.rtom) continue;
            if (!needsEnrichment(row.returnReason)) continue;
            const list = byRtom.get(row.rtom as string) || [];
            list.push({ id: row.id, soNum: row.soNum as string, returnReason: row.returnReason, comments: row.comments });
            byRtom.set(row.rtom as string, list);
        }
        if (byRtom.size === 0) return { updated: 0, checked: 0 };

        const today = new Date();
        const startDate = format(subMonths(today, 3), 'yyyy-MM-dd');
        const endDate = format(today, 'yyyy-MM-dd');

        const rtoms = [...byRtom.keys()].sort();
        // Rotate the starting RTOM across 30-minute cron cycles so every region is
        // covered over time without exceeding the sync time budget in one run.
        const cycle = Math.floor(Date.now() / (30 * 60 * 1000));
        const startIdx = maxRtoms >= rtoms.length ? 0 : cycle % rtoms.length;
        const selected: string[] = [];
        for (let i = 0; i < Math.min(maxRtoms, rtoms.length); i++) {
            selected.push(rtoms[(startIdx + i) % rtoms.length]);
        }

        let updated = 0;
        let checked = 0;
        for (const rtom of selected) {
            const portalRows = await sltApiService.fetchReturnedSODReasons(rtom, startDate, endDate);
            const reasonMap = new Map(
                portalRows.filter(p => p.RETURNED_REASON || p.RETURNED_COMMENT).map(p => [p.SO_NUM, p])
            );
            if (reasonMap.size === 0) continue;

            for (const local of byRtom.get(rtom) || []) {
                const portal = reasonMap.get(local.soNum);
                if (!portal) continue;
                checked++;
                const reason = (portal.RETURNED_REASON || '').trim();
                const comment = (portal.RETURNED_COMMENT || '').trim();
                const classification = SODReturnClassifierService.classify(`${reason} ${comment}`);
                const formattedReason = reason.toUpperCase();
                const commentPart = comment && comment.toUpperCase() !== formattedReason ? ` - ${comment}` : '';
                const newReason = formattedReason || comment
                    ? `${formattedReason}${commentPart} (${classification.category})`
                    : classification.category;
                if (local.returnReason === newReason) continue;

                const appendLine = `[PORTAL_SYNC] Reason: ${reason || 'N/A'}${comment ? ` | Comment: ${comment}` : ''}`;
                const newComments = local.comments
                    ? (local.comments.includes(appendLine) ? local.comments : `${local.comments}\n${appendLine}`)
                    : appendLine;

                await prisma.serviceOrder.update({
                    where: { id: local.id },
                    data: { returnReason: newReason, comments: newComments },
                });
                updated++;
            }
        }
        if (updated > 0) console.log(`[SYNC] Return reason enrichment: checked ${checked}, updated ${updated}.`);
        return { updated, checked };
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
     * Date-range intake sweep for one RTOM through the portal's PENDING_SLTS feed.
     *
     * Ranged re-pull companion to the per-RTOM ftthpen sweep (scheduleRtomSweep): use it to
     * backfill a specific day/period for one RTOM, e.g. after an outage, without waiting for
     * the sweep to observe the rows.
     *
     * The rows are a date slice, therefore scopedToRange disables disappearance detection -
     * absence from a slice proves nothing and would mass-flag DISAPPEARED.
     */
    static async syncPendingIntake(rtom: string, startDate: string, endDate: string) {
        const opmc = await prisma.oPMC.findFirst({ where: { rtom }, select: { id: true, rtom: true } });
        if (!opmc) return { rtom, checked: 0, created: 0, updated: 0, error: 'Unknown RTOM' };

        const rows = await sltApiService.fetchPendingSODs(rtom, startDate, endDate);
        if (rows.length === 0) return { rtom, checked: 0, created: 0, updated: 0 };

        const result = await this.syncServiceOrders(opmc.id, opmc.rtom, undefined, { rows, scopedToRange: true });
        return { rtom, checked: rows.length, created: result.created, updated: result.updated };
    }

    /**
     * Scheduler tick - the single entry point the external cron drives. One call seeds everything:
     * the per-RTOM sweep window, the bucket-aligned sub-cadences, the wall-clock dailies, and the
     * terminal-status self-heal re-assertion.
     *
     * Nothing is executed inline here: one RTOM sync costs 7-13s of portal + DB time, so a request
     * handler must never hold it. Every item becomes a queue job the worker drains.
     */
    static async runPendingSyncTick() {
        const sweep = await this.scheduleRtomSweep();
        const cadences = await this.scheduleTickJobs();
        const healed = await this.selfHealTerminalStatuses();
        return { mode: 'cron-tick' as const, sweep, cadences, healed };
    }

    /**
     * Seed the sub-tick cadences for the buckets the current moment falls in. Idempotent by job id,
     * so N worker instances and N ticks inside one bucket all collapse to a single queued job.
     */
    static async scheduleTickJobs(): Promise<{ buckets: string[]; dailies: string[] }> {
        const now = Date.now();
        const buckets: string[] = [];
        const dailies: string[] = [];

        for (const job of SODSyncService.TICK_BUCKET_JOBS) {
            const bucket = Math.floor(now / job.everyMs);
            const jobId = `tick-${job.type}-${bucket}`;
            const seeded = await this.addTickJob(sodSyncQueue, job.name, { type: job.type }, jobId, 0, job.everyMs);
            if (seeded) buckets.push(`${job.type}:${bucket}`);
        }

        for (const job of SODSyncService.TICK_DAILY_JOBS) {
            const plan = this.resolveDailyRun(job, new Date(now));
            if (!plan) continue;
            const jobId = `tick-${job.type}-${plan.dateKey}`;
            const seeded = await this.addTickJob(systemQueue, job.name, { type: job.type }, jobId, plan.delayMs, 26 * 60 * 60 * 1000);
            if (seeded) dailies.push(`${job.type}:${plan.dateKey}${plan.delayMs > 0 ? `+${Math.round(plan.delayMs / 60000)}m` : '(catch-up)'}`);
        }

        if (buckets.length > 0 || dailies.length > 0) {
            console.log(`[TICK] seeded buckets=[${buckets.join(', ')}] dailies=[${dailies.join(', ')}]`);
        }
        return { buckets, dailies };
    }

    /**
     * Resolve the SL wall-clock slot for today. Returns null when the day gate (onlyOn weekday) does
     * not match, and delayMs 0 when the slot has already passed - that turns a late first tick after
     * an outage into an immediate catch-up run instead of a skipped day.
     */
    private static resolveDailyRun(job: { at: string; onlyOn?: number }, now: Date): { dateKey: string; delayMs: number } | null {
        const slNow = new Date(now.getTime() + SODSyncService.SL_OFFSET_MS);
        if (job.onlyOn !== undefined && slNow.getUTCDay() !== job.onlyOn) return null;

        const [hh, mm] = job.at.split(':').map(Number);
        const dayStartUtcMs = Date.UTC(slNow.getUTCFullYear(), slNow.getUTCMonth(), slNow.getUTCDate());
        const slotUtcMs = dayStartUtcMs + (hh * 60 + mm) * 60 * 1000 - SODSyncService.SL_OFFSET_MS;
        return {
            dateKey: format(new Date(dayStartUtcMs), 'yyyy-MM-dd'),
            delayMs: Math.max(0, slotUtcMs - now.getTime()),
        };
    }

    /**
     * One tick-driven job. `jobId` is the dedupe key and the completed job is retained for the whole
     * bucket, otherwise a fast job would be re-queued by the next tick inside the same bucket.
     * A non-matching returned id means the queue already holds that bucket (or Redis refused the
     * write - the provider never throws), which is logged rather than reported as success.
     */
    private static async addTickJob(
        queue: { name: string },
        name: string,
        data: Record<string, unknown>,
        jobId: string,
        delayMs: number,
        retainMs: number
    ): Promise<boolean> {
        try {
            const job = await addJob(queue, name, data, {
                jobId,
                delay: Math.max(0, Math.round(delayMs)),
                removeOnComplete: { age: Math.ceil(retainMs / 1000) },
            });
            if (String(job.id) === jobId) return true;
            console.log(`[TICK] ${name} not re-seeded (bucket already queued or Redis unavailable): ${jobId}`);
            return false;
        } catch (err: unknown) {
            console.warn(`[TICK] ${name} seed failed:`, err instanceof Error ? err.message : String(err));
            return false;
        }
    }

    /**
     * The scheduled entry point. It chooses the execution model from the deployment instead of
     * assuming one, because the two available hosts cannot share a model:
     *
     * - persistent install: Redis + worker exist, so the tick only enqueues and the worker seeds
     *   the sweep windows, bucket cadences and dailies from it (no portal call in a request).
     * - serverless: there is no Redis and `instrumentation.ts` never boots a worker, so an enqueued
     *   job has no drainer. The tick therefore performs the work itself within its function budget
     *   and resumes next time from a Postgres cursor.
     */
    static async runCronTick(): Promise<Record<string, unknown>> {
        if (!this.shouldRunInlineTick()) {
            const enqueued = await enqueueCronJob(sodSyncQueue, 'cron-tick', { type: 'PERIODIC_PENDING_SYNC' });
            return { mode: 'queued', accepted: enqueued.accepted, jobId: enqueued.id };
        }
        return { mode: 'inline', ...(await this.runInlineTick()) };
    }

    /** VERCEL=1 is the authoritative signal - that is exactly when the worker is skipped. */
    private static shouldRunInlineTick(): boolean {
        const forced = process.env.CRON_INLINE_MODE;
        if (forced === 'true') return true;
        if (forced === 'false') return false;
        return process.env.VERCEL === '1';
    }

    /** Keep the inline budget below the function ceiling (60s) so work finishes before the kill. */
    private static inlineTickBudgetMs(): number {
        const raw = Number(process.env.CRON_TICK_BUDGET_MS);
        return Number.isFinite(raw) && raw >= 5000 && raw <= 50000 ? raw : 45000;
    }

    /**
     * Serverless tick: sweep RTOMs until the budget is spent, then run whichever interval tasks
     * and wall-clock dailies are due. Slots are claimed in Postgres, so an overlapping or duplicated
     * tick does no work twice, and anything left over simply stays due for the next one.
     */
    static async runInlineTick(budgetMs: number = SODSyncService.inlineTickBudgetMs()) {
        const startedAt = Date.now();
        const deadline = startedAt + budgetMs;
        const report: { ran: string[]; failed: string[]; deferred: string[] } = { ran: [], failed: [], deferred: [] };

        const lease = await tryAcquireTickLock(SODSyncService.TICK_LEASE_MS);
        if (!lease) {
            console.log('[TICK-INLINE] another tick holds the lease - nothing done');
            return { skipped: 'overlap', elapsedMs: Date.now() - startedAt };
        }

        let sweep = { synced: 0, total: 0, nextCursor: 0 };
        try {
            sweep = await this.runInlineSweepChunk(deadline, report);

            await this.runDueTask('SELF_HEAL', { kind: 'interval', intervalMs: 10 * 60 * 1000 }, deadline, report,
                'self-heal', () => this.selfHealTerminalStatuses());

            for (const job of SODSyncService.TICK_BUCKET_JOBS) {
                const plan: SlotPlan = { kind: 'interval', intervalMs: job.everyMs };
                await this.runDueTask(job.type, plan, deadline, report, job.name, () => this.runPeriodicTask(job.type));
            }

            for (const job of SODSyncService.TICK_DAILY_JOBS) {
                const due = this.resolveDailyRun(job, new Date());
                if (!due) continue;
                const plan: SlotPlan = { kind: 'daily', dayKey: due.dateKey, notBefore: Date.now() + due.delayMs };
                await this.runDueTask(job.type, plan, deadline, report, job.name, () => this.runDailyTask(job.type));
            }
        } finally {
            await releaseTickLock(lease);
        }

        console.log(`[TICK-INLINE] sweep=${sweep.synced}/${sweep.total} ran=[${report.ran.join(', ')}] ` +
            `deferred=[${report.deferred.join(', ')}] failed=[${report.failed.join(', ')}] in ${Date.now() - startedAt}ms`);
        return { sweep, ...report, elapsedMs: Date.now() - startedAt };
    }

    /**
     * Sweep from the stored cursor until the budget is spent, writing the cursor after every chunk so
     * a killed function resumes where it stopped instead of re-pulling the same RTOMs. A timed-out
     * RTOM cannot actually be cancelled, so its writes may still land after the cursor moves past it;
     * the next pass reconciles that RTOM, which is the same trade the queue path accepts.
     */
    private static async runInlineSweepChunk(
        deadline: number,
        report: { ran: string[]; failed: string[]; deferred: string[] }
    ): Promise<{ synced: number; total: number; nextCursor: number }> {
        const targets = await this.getRtomSweepTargets();
        if (targets.length === 0) return { synced: 0, total: 0, nextCursor: 0 };

        let cursor = await readSweepCursor(targets.length);
        let synced = 0;
        let created = 0;
        let updated = 0;

        while (Date.now() + SODSyncService.RTOM_INLINE_TIMEOUT_MS < deadline) {
            const chunk = targets.slice(cursor, cursor + SODSyncService.RTOM_INLINE_CONCURRENCY);
            const results = await Promise.all(chunk.map(async (target) => {
                const [err, res] = await safe(this.withTimeout(
                    this.syncServiceOrders(target.id, target.rtom),
                    SODSyncService.RTOM_INLINE_TIMEOUT_MS,
                    `RTOM ${target.rtom} sweep`
                ));
                if (err || !res) {
                    report.failed.push(`sweep:${target.rtom} - ${err instanceof Error ? err.message : String(err)}`);
                    return { created: 0, updated: 0 };
                }
                return res;
            }));

            for (const r of results) {
                created += r.created;
                updated += r.updated;
            }
            synced += chunk.length;
            cursor = (cursor + chunk.length) % targets.length;
            await writeSweepCursor(cursor);
        }

        if (created > 0 || updated > 0) await this.updateGlobalSyncStats({ created, updated });
        return { synced, total: targets.length, nextCursor: cursor };
    }

    /**
     * Run one scheduled task when its slot is due and the budget is still open. A failure hands the
     * claim back, so the next tick retries instead of waiting out the whole interval (or losing a
     * whole day for a daily). Not-due and lost-race both come back as a silent no-op.
     */
    private static async runDueTask(
        taskId: string,
        plan: SlotPlan,
        deadline: number,
        report: { ran: string[]; failed: string[]; deferred: string[] },
        label: string,
        work: () => Promise<unknown>
    ): Promise<void> {
        if (Date.now() > deadline) {
            report.deferred.push(label);
            return;
        }
        if (!await claimSlot(taskId, plan)) return;

        const started = Date.now();
        try {
            await work();
            report.ran.push(`${label}=${Date.now() - started}ms`);
        } catch (err: unknown) {
            report.failed.push(`${label} - ${err instanceof Error ? err.message : String(err)}`);
            await releaseSlot(taskId);
        }
    }

    /** Same bodies the sod-sync worker branches run, so both execution models do identical work. */
    private static async runPeriodicTask(type: 'PERIODIC_COMPLETED_SYNC' | 'PERIODIC_GLOBAL_SYNC' | 'PERIODIC_RETURN_SYNC'): Promise<unknown> {
        if (type === 'PERIODIC_COMPLETED_SYNC') {
            const { CompletedSODSyncService } = await import('./completed-sod-sync.service');
            return CompletedSODSyncService.syncCompletedSODs();
        }
        if (type === 'PERIODIC_GLOBAL_SYNC') {
            const approved = await this.syncHoApprovedResults();
            const rejected = await this.syncHoRejectedResults();
            return { approved, rejected };
        }
        return this.syncReturnReasons();
    }

    /** Same bodies the system worker branches run. */
    private static async runDailyTask(type: 'DAILY_REPORT_SNAPSHOT' | 'APPOINTMENT_REMINDERS' | 'DAILY_AUTOMATION' | 'NOTIFICATION_CLEANUP'): Promise<unknown> {
        if (type === 'DAILY_REPORT_SNAPSHOT') {
            const { ReportService } = await import('../core/report.service');
            return ReportService.persistClosedSriLankaDaySnapshot();
        }
        if (type === 'APPOINTMENT_REMINDERS') {
            const { AppointmentNotificationService } = await import('../notification/appointment-notification.service');
            return AppointmentNotificationService.checkAndNotify();
        }
        if (type === 'DAILY_AUTOMATION') {
            const { AutomationService } = await import('../automation/automation.service');
            return AutomationService.runAllDailyTasks();
        }
        const { NotificationService } = await import('../notification/notification.service');
        return NotificationService.cleanup();
    }

    /** Bound one unit of work; the underlying promise cannot be cancelled, only ignored. */
    private static async withTimeout<T>(work: Promise<T>, ms: number, label: string): Promise<T> {
        let timer: ReturnType<typeof setTimeout> | undefined;
        try {
            return await Promise.race([
                work,
                new Promise<never>((_, reject) => {
                    timer = setTimeout(() => reject(new Error(`${label} exceeded ${ms}ms`)), ms);
                }),
            ]);
        } finally {
            if (timer) clearTimeout(timer);
        }
    }

    /**
     * Queue-level RTOM sweep scheduler - refreshes EVERY RTOM's live worklist (ASSIGNED /
     * INPROGRESS / PROV_CLOSED / INSTALL_CLOSED) on a fixed window.
     *
     * syncAllOpmcs still defaults to a 15-OPMC slice per call (a historical limit), so ranks
     * outside the slice went minutes-to-days without a refresh. The sweep ignores slicing
     * altogether: one short single-RTOM job per RTOM, staggered across the coming window, and
     * each executed job re-seeds its own next window (self-sustaining chain). The external
     * 10-minute tick seeds the same window with the same deterministic ids, so the ping is a
     * recovery path rather than a second source of portal calls.
     *
     * Job ids are deterministic per (rtom, window) so seeding from several worker instances
     * is a no-op instead of duplicate portal calls.
     *
     * @returns number of RTOM jobs that were scheduled for the next window.
     */
    static async scheduleRtomSweep(windowMs: number = SODSyncService.RTOM_SWEEP_WINDOW_MS) {
        const targets = await this.getRtomSweepTargets();
        if (targets.length === 0) return { seeded: 0, window: 0, windowMs };

        const now = Date.now();
        const window = Math.floor(now / windowMs) + 1;
        const staggerMs = Math.max(1000, Math.floor(windowMs / targets.length));
        let seeded = 0;

        for (let i = 0; i < targets.length; i++) {
            const target = targets[i];
            const scheduled = await this.scheduleRtomSweepJob(target, window, windowMs, i * staggerMs);
            if (scheduled) seeded++;
        }

        console.log(`[RTOM-SWEEP] seeded=${seeded}/${targets.length} window=${window} every=${Math.round(windowMs / 60000)}min stagger=${staggerMs}ms`);
        return { seeded, window, windowMs };
    }

    /**
     * Seed one RTOM's job for a given absolute window. `slotMs` staggers the run inside the
     * window; a duplicate jobId (already queued by another instance/chain hop) is treated as
     * success rather than an error.
     */
    private static async scheduleRtomSweepJob(
        target: { id: string; rtom: string },
        window: number,
        windowMs: number,
        slotMs: number
    ): Promise<boolean> {
        const jobId = `${SODSyncService.RTOM_SWEEP_JOB_PREFIX}-${target.rtom}-${window}`;
        const delay = Math.max(0, window * windowMs - Date.now() + slotMs);
        try {
            await addJob(sodSyncQueue, 'rtom-sweep', {
                opmcId: target.id,
                rtom: target.rtom,
                type: 'RTOM_SWEEP',
                windowMs,
                slotMs
            }, { jobId, delay });
            return true;
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            if (!/already exists|duplicate/i.test(msg)) console.warn(`[RTOM-SWEEP] ${target.rtom} seed failed: ${msg}`);
            return false;
        }
    }

    /**
     * Continuation hop used by the worker after a RTOM_SWEEP job finishes: re-seed only this
     * RTOM's next window so the chain survives without a new cron entry. `slotMs` carries the
     * RTOM's stagger position, otherwise every chain hop would pile all RTOMs onto the window
     * boundary and burst the portal instead of spreading the load.
     */
    static async rescheduleRtomSweep(opmcId: string, rtom: string, windowMs: number = SODSyncService.RTOM_SWEEP_WINDOW_MS, slotMs: number = 0) {
        const window = Math.floor(Date.now() / windowMs) + 1;
        return this.scheduleRtomSweepJob({ id: opmcId, rtom }, window, windowMs, Math.max(0, slotMs));
    }

    /** Distinct RTOM sweep targets (one job per RTOM, stable order). */
    private static async getRtomSweepTargets(): Promise<Array<{ id: string; rtom: string }>> {
        const opmcs = await prisma.oPMC.findMany({ select: { id: true, rtom: true }, orderBy: { rtom: 'asc' } });
        const seen = new Set<string>();
        const targets: Array<{ id: string; rtom: string }> = [];
        for (const opmc of opmcs) {
            if (!opmc.rtom || seen.has(opmc.rtom)) continue;
            seen.add(opmc.rtom);
            targets.push({ id: opmc.id, rtom: opmc.rtom });
        }
        return targets;
    }

    /**
     * Sync single OPMC Service Orders
     *
     * options.rows feeds a caller-supplied portal result set (e.g. the ranged PENDING_SLTS
     * intake feed) instead of the full ftthpen snapshot; options.scopedToRange declares that
     * the supplied rows are a partial slice, which turns off DISAPPEARED inference.
     */
    static async syncServiceOrders(
        opmcId: UUID,
        rtom: string,
        preloadedPendingSods?: { id: UUID; soNum: string | null; sltsStatus: string; status: string; returnReason: string | null; comments: string | null; opmcId: UUID }[],
        options?: { rows?: SLTServiceOrderData[]; scopedToRange?: boolean }
    ) {
        const scopedToRange = options?.scopedToRange === true;
        const sltData = options?.rows ?? await sltApiService.fetchServiceOrders(rtom);
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
            // Skip INSTALL_CLOSED — handled exclusively by completed-sod-sync service
            const cleanStatusForSkip = (item.CON_STATUS || '').toUpperCase().trim();
            if (cleanStatusForSkip === 'INSTALL_CLOSED') continue;

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
            // RETURN transitions use the ERP-side sync time: the return date is when the ERP
            // learned about the return (drives Return Date column + return month attribution),
            // not the portal CON_STATUS_DATE which can lag the actual notification by days.
            const isReturnTransition = initialSltsStatus === 'RETURN' && (!existing || existing.sltsStatus !== 'RETURN');
            const effectiveCompletedDate = (initialSltsStatus === 'COMPLETED' || isInstallClosed)
                ? (existing?.receivedDate && statusDate < existing.receivedDate ? existing.receivedDate : statusDate)
                : (isReturnTransition ? new Date() : undefined);

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
                // A row that surfaces in a portal date range only because someone touched its
                // status is not today's intake. The SOD number carries the order-raise date
                // (never later than the real receipt), so when the status instant trails that
                // date by more than a day the receipt anchor moves back to the raise date.
                // Genuine same-day / next-day intake keeps the portal status date untouched.
                const raisedDate = orderRaiseDateFromSoNum(item.SO_NUM);
                const receiptWasRedated = !!raisedDate && statusDate.getTime() - raisedDate.getTime() > 86400000;
                if (!isFinished || isRecent) {
                    toCreate.push({
                        ...updatePayload,
                        opmcId,
                        contractorId: contractorId || null,
                        rtom: item.RTOM || rtom,
                        soNum: item.SO_NUM,
                        // A record that arrives already closed carries its closure instant in
                        // CON_STATUS_DATE, not a receipt. Stamping that as receivedDate made
                        // month-old jobs show up as "Received Today" on the Daily Operational
                        // Report, so born-finished rows take the order-raise date embedded in
                        // the SOD number instead. Open rows keep the portal status date, which
                        // is the genuine received/assigned moment.
                        receivedDate: (isFinished || receiptWasRedated)
                            ? backfillReceiptDate(item.SO_NUM, statusDate)
                            : statusDate,
                        // Born-RETURN: return date = the ERP capture moment (when the import
                        // learned the return). Portal CON_STATUS_DATE is the received-date
                        // mirror, NOT the return date.
                        completedDate: (initialSltsStatus === 'COMPLETED' || isInstallClosed)
                            ? statusDate
                            : (initialSltsStatus === 'RETURN' ? new Date() : null),
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
                    updatePayload.completedDate = null; // Return date no longer applies once reactivated
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
                            // Portal-mapped status is validated upstream (mapExternalStatusToSltsStatus);
                            // this only narrows the string type to the Prisma enum for the spread.
                            sltsStatus: updatePayload.sltsStatus as ServiceOrderStatus | undefined
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
                // Born-RETURN creates bypass handlePostUpdate — seed their RETURN history
                // entry so the Work History timeline shows the return event.
                const returnCreates = toCreate.filter(c => c.sltsStatus === 'RETURN');
                if (returnCreates.length > 0) {
                    const createdRows = await prisma.serviceOrder.findMany({
                        where: { soNum: { in: returnCreates.map(c => c.soNum as string) } },
                        select: { id: true, soNum: true }
                    });
                    const [histErr] = await safe(prisma.serviceOrderStatusHistory.createMany({
                        data: createdRows.map(r => {
                            const src = returnCreates.find(c => c.soNum === r.soNum);
                            return { serviceOrderId: r.id, status: 'RETURN', statusDate: (src?.completedDate as Date | null) ?? new Date() };
                        }),
                        skipDuplicates: true
                    }));
                    if (histErr) console.error(`[SYNC] Failed to seed born-RETURN history for ${rtom}:`, histErr);
                }
            }
        }

        // ── Pending set for disappearance inference ──
        // Callers may hand in a pre-loaded set to skip this query; the per-RTOM sweep and the
        // worker path pass nothing, so the open SODs for this OPMC are read here.
        // A range-scoped feed holds only the orders touched inside one window. Comparing it
        // against every local open SOD would flag all the others as DISAPPEARED, so the
        // pending set is forced empty and the whole block below becomes a no-op.
        const emptyPending: { id: UUID; soNum: string | null; sltsStatus: string; status: string; returnReason: string | null; comments: string | null }[] = [];
        const localPendingSods = scopedToRange ? emptyPending : (preloadedPendingSods ?? await prisma.serviceOrder.findMany({
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
        }));

        const sltSoNumSet = new Set(sltSoNums);
        // Coverage guard: the per-RTOM sweep now visits every RTOM every window, so a thin or
        // partial portal response must not be able to mass-flag DISAPPEARED. A live ftthpen
        // worklist normally carries tens of rows; a handful of rows against a large local open
        // backlog means the feed failed, not that the work vanished.
        const feedTooThinToInfer = !scopedToRange && sltData.length < 5 && localPendingSods.length > 10;
        if (feedTooThinToInfer) {
            console.warn(`[SYNC-DISAPPEARED] Skipped inference for ${rtom}: feed rows=${sltData.length} vs local open=${localPendingSods.length} (partial portal response assumed).`);
        }
        const disappearedSods = feedTooThinToInfer ? [] : localPendingSods.filter(sod => sod.soNum && !sltSoNumSet.has(sod.soNum));

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
                                // RETURN: ERP-side time (when the recovery sync learned the return)
                                completedDate: (nextSltsStatus === 'COMPLETED' || nextSltsStatus === 'INSTALL_CLOSED')
                                    ? statusDate
                                    : (nextSltsStatus === 'RETURN' ? new Date() : null),
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
            const trimmedComment = String(rawComment).trim();
            const commentPart = trimmedComment && trimmedComment.toUpperCase() !== formattedReason ? ` - ${trimmedComment}` : '';
            mapping.returnReason = formattedReason || trimmedComment
                ? `${formattedReason}${commentPart} (${classification.category})`
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

        // Resolve the assigned portal team early — it drives both the OPMC
        // (region) fallback and the contractor/team linkage below. Portal team
        // names look like "SLTSKON_T14 - Anuradha".
        const teamName = (teamDetails?.['SELECTED TEAM'] || masterData['MOBILE_TEAM_DETAILS'] || masterData['TEAM_DETAILS'] || masterData['ASSIGNED_TEAM']) as string | undefined;
        let resolvedTeam: { id: string; contractorId: string; opmcId: string | null; opmc: { rtom: string } | null } | null = null;
        if (teamName) {
            const teamCode = teamName.split('-')[0].trim();
            resolvedTeam = await prisma.contractorTeam.findFirst({
                where: {
                    OR: [
                        { name: { contains: teamName.trim(), mode: 'insensitive' } },
                        { sltCode: teamCode.trim().toUpperCase() }
                    ]
                },
                select: { id: true, contractorId: true, opmcId: true, opmc: { select: { rtom: true } } }
            });
        }

        // RTOM sanity: the scraper can capture a neighbouring UI label (e.g.
        // "SERVICE ORDER") as the RTOM value on sod_details pages. Only accept
        // real RTOM codes (R-XX / R-XXX / R-XXXX).
        const isValidRtom = (v: unknown): v is string => typeof v === 'string' && /^R-[A-Z]{2,4}$/.test(v.trim().toUpperCase());
        const rtomVal = [mapping.rtom, serviceOrder?.rtom].find(isValidRtom)?.trim().toUpperCase();

        if (!opmcId && rtomVal) {
            // Use exact match on indexed rtom column first, then fallback to prefix contains
            const opmc = await prisma.oPMC.findFirst({
                where: { rtom: rtomVal }
            }) || await prisma.oPMC.findFirst({
                where: { rtom: { contains: rtomVal.substring(0, 4), mode: 'insensitive' } }
            });
            opmcId = opmc?.id;
        }
        // Region fallback: teams are OPMC-bound — derive the region from the
        // assigned portal team when the RTOM is missing or garbage.
        if (!opmcId && resolvedTeam?.opmcId) {
            opmcId = resolvedTeam.opmcId;
        }
        // Never silently default to an arbitrary OPMC (previously the first
        // OPMC alphabetically, which dumped unknown-region SODs into R-AD):
        // a new SOD whose region cannot be resolved rejects the push instead.
        // The extension retry queue surfaces it as FAILED for manual triage.
        if (!opmcId) {
            throw AppError.validation(
                `Cannot determine region (OPMC) for SOD ${soNum}: portal RTOM missing/invalid and team "${teamName ?? 'N/A'}" is not mapped to an OPMC. Assign the region manually before re-syncing.`
            );
        }

        const isOffline = (payload.url && payload.url.toLowerCase().includes('offline')) ||
            (masterData['COMPLETION_MODE'] && String(masterData['COMPLETION_MODE']).toUpperCase().includes('OFFLINE'));

        const dataToUpdate: Partial<Prisma.ServiceOrderUncheckedUpdateInput> = {
            ...mapping,
            completionMode: isOffline ? 'OFFLINE' : (mapping.completionMode || serviceOrder?.completionMode || 'Standard'),
            rtom: rtomVal || resolvedTeam?.opmc?.rtom || serviceOrder?.rtom || 'UNKNOWN',
            opmcId,
            updatedAt: new Date(),
        };

        const rcvDate = SodUtils.safeParseDate(masterData['RECEIVED DATE'] || SodUtils.deepParse(masterData)['RECEIVED DATE']);
        if (rcvDate) dataToUpdate.receivedDate = rcvDate;

        const stDate = SodUtils.safeParseDate(masterData['STATUS DATE'] || SodUtils.deepParse(masterData)['STATUS DATE']);
        if (stDate) dataToUpdate.statusDate = stDate;

        // Scraper label-leak guard: on sod_details pages the scraped STATUS
        // often captures a neighbouring table row or a UI label. Only accept
        // known portal status tokens; otherwise fall back to the status token
        // embedded in the portal URL (sod=<SO>_<STATUS>_<ledgerId>_FTTH).
        const KNOWN_PORTAL_STATUSES = new Set([
            'COMPLETED', 'INSTALL_CLOSED', 'PAT_OPMC_PASSED', 'PAT_PASSED', 'PAT_PASSED_OPMC',
            'RETURN', 'RETURN_PENDING', 'ASSIGN', 'ASSIGNED', 'INPROGRESS',
            'PROV_CLOSED', 'CANCELLED', 'REJECTED', 'PENDING'
        ]);
        let statusStr = (masterData['CON_STATUS'] || masterData['STATUS'] || deepData['STATUS'] || '').toString().toUpperCase().trim();
        if (!KNOWN_PORTAL_STATUSES.has(statusStr)) {
            const urlStatusMatch = (payload.url || '').match(/sod=[A-Z0-9]+_([A-Z_]+)_\d+/i);
            const urlStatus = urlStatusMatch?.[1]?.toUpperCase();
            if (urlStatus && KNOWN_PORTAL_STATUSES.has(urlStatus)) {
                statusStr = urlStatus;
            }
        }
        const currentStatus = statusStr;

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

            // Only set a completion date we actually know. The contractor-view
            // scrape carries no completion date field; fabricating the push time
            // would bucket the SOD into the push month (born-completed SODs whose
            // real completion was months earlier would surface on the wrong
            // completed page). Leave unset — completed-sod-sync enriches it from
            // the portal's CON_STATUS_DATE, and the completed page buckets
            // strictly by completedDate.
            if (installDate) {
                dataToUpdate.completedDate = installDate;
            }

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
            // The mapping block above already captured the raw portal reason + comment
            // (richer: includes rt_comment). Only fill gaps when it did not run
            // (status-token returns with no master return fields).
            if (!mapping.returnReason) {
                const rawReason = masterData['RETURN REASON'] || masterData['REJECTION REASON'] || statusStr || 'Returned in external portal';
                const rawComment = String(masterData['RETCMT_HIDDEN'] || masterData['RTCMTALL_HIDDEN'] || masterData['RETURN COMMENT'] || masterData['rtcmtall'] || masterData['rt_comment'] || '').trim();
                const classification = SODReturnClassifierService.classify(`${rawReason} ${rawComment}`);
                const formattedReason = String(rawReason).toUpperCase().trim();
                const commentPart = rawComment && rawComment.toUpperCase() !== formattedReason ? ` - ${rawComment}` : '';
                dataToUpdate.returnReason = formattedReason || rawComment
                    ? `${formattedReason}${commentPart} (${classification.category})`
                    : classification.category;
                const fallbackComment = `[AI_CLASSIFIED] Reason: ${rawReason}${rawComment ? ` | Comment: ${rawComment}` : ''}`;
                dataToUpdate.comments = serviceOrder?.comments
                    ? (serviceOrder.comments.includes(fallbackComment) ? serviceOrder.comments : `${serviceOrder.comments}\n${fallbackComment}`)
                    : fallbackComment;
            }
            // Return date = the ERP capture time: when the bridge first learned the return
            // (new row) or caught the transition (active -> RETURN). Re-pushes of an
            // already-RETURN SOD touch nothing.
            if (!serviceOrder || serviceOrder.sltsStatus !== 'RETURN') {
                dataToUpdate.completedDate = new Date();
            }
            dataToUpdate.revenueAmount = null;
            dataToUpdate.contractorAmount = null;
        } else if (currentStatus === 'ASSIGN' || currentStatus === 'ASSIGNED') {
            // Mirror the portal assignment flag verbatim - pending tables display it as ASSIGNED
            dataToUpdate.sltsStatus = SodStatus.ASSIGNED;
        }

        // Team linkage reuses the team resolved during OPMC resolution above
        if (teamName) {
            dataToUpdate.directTeam = teamName.trim();
            if (resolvedTeam) {
                dataToUpdate.teamId = resolvedTeam.id;
                dataToUpdate.contractorId = resolvedTeam.contractorId;
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
            const createdSltsStatus = (dataToUpdate.sltsStatus as string) || 'INPROGRESS';
            // Workflow status must mirror the portal status coherently. The
            // SOD_STATUS_INVARIANT trigger only guards UPDATE, so an incoherent
            // born-terminal row is accepted at CREATE but becomes permanently
            // update-locked afterwards (every later write rejects). Map the
            // workflow status to the same terminal value on create.
            const createdWorkflowStatus =
                createdSltsStatus === 'RETURN' ? 'RETURN' as const
                    : createdSltsStatus === 'INSTALL_CLOSED' ? 'INSTALL_CLOSED' as const
                        : ['COMPLETED', 'PAT_OPMC_PASSED', 'PAT_PASSED', 'PAT_PASSED_OPMC'].includes(createdSltsStatus) ? 'COMPLETED' as const
                            : createdSltsStatus === 'ASSIGNED' ? 'ASSIGNED' as const
                                : 'PENDING' as const;
            syncedOrder = await (prisma.serviceOrder as unknown as { create: (args: { data: unknown }) => Promise<import('@prisma/client').ServiceOrder> }).create({
                data: {
                    ...dataToUpdate,
                    soNum: soNum || "",
                    status: createdWorkflowStatus,
                    sltsStatus: createdSltsStatus,
                    iptvSerials: iptvSerials.length > 0 ? {
                        create: iptvSerials.map(sn => ({ serialNumber: sn }))
                    } : undefined
                }
            });
            // Born-RETURN bridge creates bypass handlePostUpdate — seed the RETURN
            // history entry so Work History shows the return event.
            if (syncedOrder.sltsStatus === 'RETURN') {
                const [histErr] = await safe(prisma.serviceOrderStatusHistory.create({
                    data: { serviceOrderId: syncedOrder.id, status: 'RETURN', statusDate: syncedOrder.completedDate ?? new Date() }
                }));
                if (histErr) console.error('[BRIDGE-SYNC] Failed to seed born-RETURN history:', histErr);
            }
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
                // Audit trail: single-SOD bridge pushes bypass handlePostUpdate on purpose
                // (publishing sod.status_changed here would double-fire the notification below)
                // Event-date discipline: never label a completion event with the push
                // time. A born-terminal SOD (the extension saw it already completed)
                // carries no truthful completion date — completed-sod-sync seeds its
                // history event later, dated with the portal's real date. Writing
                // COMPLETED@push-time here made the Daily Report count the birth day
                // instead of the actual completion day.
                const bornTerminalWithoutDate =
                    [SodStatus.COMPLETED, SodStatus.INSTALL_CLOSED].includes(syncedOrder.sltsStatus as SodStatus) &&
                    !syncedOrder.completedDate && !syncedOrder.statusDate;
                if (!bornTerminalWithoutDate) {
                    const { ServiceOrderRepository } = await import('@/repositories/service-order.repository');
                    await ServiceOrderRepository.createStatusHistory({
                        serviceOrderId: syncedOrder.id,
                        status: syncedOrder.sltsStatus,
                        statusDate: syncedOrder.completedDate || syncedOrder.statusDate || new Date()
                    });
                }
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
