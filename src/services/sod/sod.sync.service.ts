import { prisma } from '@/lib/prisma';
import { Prisma, ServiceOrder } from '@prisma/client';
import { sltApiService, SLTServiceOrderData, SLTPATData } from '../slt-api.service';
import { addJob, statsUpdateQueue, sodSyncQueue } from '../../lib/queue';
import { SODMaterialService } from './sod.material.service';
import { LedgerService } from '../finance/ledger.service';
import { SODReturnClassifierService } from './sod-return-classifier.service';
import { SodUtils } from './sod.utils';
import { SodStatus, SOD_COMPLETION_STATUSES, SOD_RETURN_STATUSES } from '@/lib/constants/sod-constants';
import { MaterialUsageInput } from './sod-types';
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
     * Sync PAT results from SLT APIs (OPMC Rejected and PAT Success)
     */
    static async syncPatResults(opmcId: string, rtom: string) {
        try {
            const results = await Promise.all([
                sltApiService.fetchPATResults(rtom),
                sltApiService.fetchOpmcRejected(rtom)
            ]);

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

            await prisma.sLTPATStatus.deleteMany({
                where: { soNum: { in: soNums } }
            });

            await prisma.sLTPATStatus.createMany({
                data: statusHistory as Prisma.SLTPATStatusCreateManyInput[]
            });

            const matchingOrders = await prisma.serviceOrder.findMany({
                where: {
                    soNum: { in: soNums },
                    sltsStatus: 'COMPLETED'
                },
                select: { id: true, soNum: true, sltsPatStatus: true, hoPatStatus: true }
            });

            const sltDataMap = new Map(sltData.map(item => [item.SO_NUM, item]));

            for (const order of matchingOrders) {
                const match = sltDataMap.get(order.soNum);
                if (match) {
                    const status = match.CON_STATUS;
                    await prisma.serviceOrder.update({
                        where: { id: order.id },
                        data: {
                            opmcPatStatus: status,
                            opmcPatDate: sltApiService.parseStatusDate(match.CON_STATUS_DATE),
                            isInvoicable: status === 'PAT_PASSED' && 
                                          order.hoPatStatus === 'PAT_PASSED' && 
                                          order.sltsPatStatus === 'PAT_PASSED'
                        }
                    });
                }
            }

            if (matchingOrders.length > 0) {
                try {
                    await addJob(statsUpdateQueue, `stats-${opmcId}`, {
                        opmcId,
                        type: 'SINGLE_OPMC'
                    });
                } catch (queueErr) {
                    console.warn(`[PAT-SYNC] Failed to queue stats update for OPMC ${opmcId}:`, queueErr);
                }
            }

            return { total: sltData.length, updated: matchingOrders.length };
        } catch (err) {
            console.error('[PAT-SYNC] Sync Failed:', err);
            return { total: 0, error: String(err) };
        }
    }

    /**
     * Sync HO Approved PAT results (Global)
     */
    static async syncHoApprovedResults() {
        try {
            let data = await sltApiService.fetchHOApprovedGlobal();
            
            const lastSyncSetting = await prisma.systemSetting.findUnique({ where: { key: 'LAST_HO_APPROVED_SYNC' } });
            const filterDate = lastSyncSetting ? new Date(lastSyncSetting.value as string) : new Date('2020-01-01');

            if (!data || data.length === 0) {
                const dateStr = filterDate.toISOString().split('T')[0];
                data = await sltApiService.fetchPATResultsByDate(dateStr);
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

                await prisma.sLTPATStatus.deleteMany({
                    where: { soNum: { in: soNums } }
                });

                const result = await prisma.sLTPATStatus.createMany({
                    data: cacheData as Prisma.SLTPATStatusCreateManyInput[]
                });
                totalCached += result.count;

                const ordersToUpdate = await prisma.serviceOrder.findMany({
                    where: {
                        soNum: { in: soNums },
                        sltsStatus: 'COMPLETED',
                        hoPatStatus: { not: 'PAT_PASSED' }
                    },
                    select: { id: true, soNum: true, sltsPatStatus: true }
                });

                const batchMap = new Map(batch.map((b: SLTPATData) => [b.SO_NUM, b]));
                for (const order of ordersToUpdate) {
                    const match = batchMap.get(order.soNum);
                    if (match) {
                        await prisma.serviceOrder.update({
                            where: { id: order.id },
                            data: {
                                hoPatStatus: 'PAT_PASSED',
                                hoPatDate: sltApiService.parseStatusDate(match.CON_STATUS_DATE),
                                opmcPatStatus: 'PAT_PASSED',
                                isInvoicable: order.sltsPatStatus === 'PAT_PASSED'
                            }
                        });
                        totalUpdated++;
                    }
                }
            }

            const opmcs = await prisma.oPMC.findMany({ select: { id: true } });
            for (const opmc of opmcs) {
                try {
                    await addJob(statsUpdateQueue, `stats-${opmc.id}`, { opmcId: opmc.id, type: 'SINGLE_OPMC' });
                } catch (queueErr) {
                    console.warn(`[PAT-SYNC] Failed to queue stats update for OPMC ${opmc.id} (Workers might be disabled):`, queueErr);
                }
            }

            return { totalCached, totalUpdated };
        } catch (err) {
            console.error('[PAT-SYNC] HO Approved Sync Failed:', err);
            return { totalCached: 0, totalUpdated: 0, error: String(err) };
        }
    }

    /**
     * Sync HO Rejected PAT results (Global)
     */
    static async syncHoRejectedResults() {
        try {
            const data = await sltApiService.fetchHORejected();
            
            const lastSyncSetting = await prisma.systemSetting.findUnique({ where: { key: 'LAST_HO_REJECTED_SYNC' } });
            const filterDate = lastSyncSetting ? new Date(lastSyncSetting.value as string) : new Date('2020-01-01');

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

                await prisma.sLTPATStatus.deleteMany({
                    where: { soNum: { in: soNums } }
                });

                const result = await prisma.sLTPATStatus.createMany({
                    data: cacheData as Prisma.SLTPATStatusCreateManyInput[]
                });
                totalCached += result.count;

                const ordersToUpdate = await prisma.serviceOrder.findMany({
                    where: {
                        soNum: { in: soNums },
                        hoPatStatus: { not: 'PAT_REJECTED' }
                    },
                    select: { id: true, soNum: true }
                });

                const batchMap = new Map(batch.map((b: SLTPATData) => [b.SO_NUM, b]));
                for (const order of ordersToUpdate) {
                    const match = batchMap.get(order.soNum);
                    if (match) {
                        await prisma.$transaction(async (tx) => {
                            await tx.serviceOrder.update({
                                where: { id: order.id },
                                data: {
                                    hoPatStatus: 'PAT_REJECTED',
                                    hoPatDate: sltApiService.parseStatusDate(match.CON_STATUS_DATE),
                                    isInvoicable: false
                                }
                            });
                            // Trigger rollbacks since it got HO-rejected
                            await SODMaterialService.rollbackMaterialUsage(tx, order.id, 'HO_REJECT');
                            await LedgerService.rollbackSodTransaction(tx, order.id);
                        });
                        totalUpdated++;
                    }
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
                try {
                    await addJob(statsUpdateQueue, `stats-${opmc.id}`, { opmcId: opmc.id, type: 'SINGLE_OPMC' });
                } catch (queueErr) {
                    console.warn(`[PAT-SYNC] Failed to queue stats update for OPMC ${opmc.id} (Workers might be disabled):`, queueErr);
                }
            }

            return { totalCached, totalUpdated };
        } catch (err) {
            console.error('[PAT-SYNC] HO Rejected Sync Failed:', err);
            return { totalCached: 0, totalUpdated: 0, error: String(err) };
        }
    }

    /**
     * Trigger sync for all OPMCs
     */
    static async syncAllOpmcs() {
        const opmcs = await prisma.oPMC.findMany({ select: { id: true, rtom: true }, orderBy: { rtom: 'asc' } });
        
        if (process.env.VERCEL === '1') {
            console.log('[SYNC] Serverless/Vercel environment: running sync synchronously for all OPMCs...');
            let created = 0;
            let updated = 0;
            const results = [];
            for (const opmc of opmcs) {
                try {
                    const res = await this.syncServiceOrders(opmc.id, opmc.rtom);
                    created += res.created;
                    updated += res.updated;
                    results.push({ rtom: opmc.rtom, ...res });
                } catch (e) {
                    console.error(`[SYNC] Failed to sync ${opmc.rtom}:`, e);
                    results.push({ rtom: opmc.rtom, error: String(e) });
                }
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
    static async syncServiceOrders(opmcId: string, rtom: string) {
        const sltData = await sltApiService.fetchServiceOrders(rtom);
        if (!sltData || sltData.length === 0) return { created: 0, updated: 0 };

        const sltSoNums = sltData.map(item => item.SO_NUM);
        const existingSods = await prisma.serviceOrder.findMany({
            where: { soNum: { in: sltSoNums } },
            select: { id: true, soNum: true, sltsStatus: true, status: true, returnReason: true, comments: true }
        });
        const existingMap = new Map<string, { id: string; soNum: string; sltsStatus: string; status: string; returnReason: string | null; comments: string | null }>(
            existingSods.map(s => [s.soNum as string, s])
        );

        const uniqueSyncMap = new Map<string, SLTServiceOrderData>();
        sltData.forEach(item => {
            const existing = existingMap.get(item.SO_NUM);
            if (existing?.sltsStatus === 'COMPLETED') return;
            const currentInMap = uniqueSyncMap.get(item.SO_NUM);
            if (currentInMap && currentInMap.CON_STATUS === 'INSTALL_CLOSED') return;
            uniqueSyncMap.set(item.SO_NUM, item);
        });
        const syncableData = Array.from(uniqueSyncMap.values());

        let created = 0; let updated = 0;
        const chunkSize = 5;
        for (let i = 0; i < syncableData.length; i += chunkSize) {
            const chunk = syncableData.slice(i, i + chunkSize);
            await Promise.all(chunk.map(async (item) => {
                try {
                    const statusDate = sltApiService.parseStatusDate(item.CON_STATUS_DATE) || new Date();
                    const completionStatuses = ['INSTALL_CLOSED'];
                    const returnStatuses = ['RETURN', 'RETURNED', 'REJECTED', 'CANCELLED', 'CANCEL', 'COMPLETED-RETURN'];
                    
                    let initialSltsStatus = 'INPROGRESS';
                    if (completionStatuses.includes(item.CON_STATUS)) {
                        initialSltsStatus = 'COMPLETED';
                    } else if (returnStatuses.includes((item.CON_STATUS || '').toUpperCase())) {
                        initialSltsStatus = 'RETURN';
                    }

                    const existing = existingMap.get(item.SO_NUM);
                    const updatePayload: Prisma.ServiceOrderUncheckedUpdateInput = {
                        status: item.CON_STATUS,
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
                        completedDate: initialSltsStatus === 'COMPLETED' ? statusDate : undefined,
                        sltsStatus: initialSltsStatus,
                        returnReason: initialSltsStatus === 'RETURN' ? (item.CON_STATUS || 'Returned in external portal') : undefined
                    };

                    if (existing) {
                        const isRestoring = (existing.sltsStatus === 'RETURN' && initialSltsStatus === 'INPROGRESS');
                        const isReturning = (initialSltsStatus === 'RETURN' && existing.sltsStatus !== 'RETURN');
                        
                        await prisma.$transaction(async (tx) => {
                            await tx.serviceOrder.update({
                                where: { id: existing.id },
                                data: {
                                    ...updatePayload,
                                    sltsStatus: isRestoring ? 'INPROGRESS' : (updatePayload.sltsStatus as string),
                                    receivedDate: isRestoring ? new Date() : undefined,
                                    comments: isRestoring
                                        ? (existing.comments ? `${existing.comments}\n[AUTO-RESTORE] Prev Return: ${existing.returnReason || existing.status}` : `[AUTO-RESTORE] Prev Return: ${existing.returnReason || existing.status}`)
                                        : undefined,
                                    returnReason: isRestoring ? null : undefined
                                }
                            });
                            
                            if (isReturning) {
                                await SODMaterialService.rollbackMaterialUsage(tx, existing.id, 'SYNC_SERVICE');
                                await LedgerService.rollbackSodTransaction(tx, existing.id);
                            }
                        });
                        updated++;
                    } else {
                        const isFinished = initialSltsStatus === 'COMPLETED';
                        const isRecent = statusDate.getFullYear() >= 2026;
                        if (!isFinished || isRecent) {
                            await prisma.serviceOrder.create({
                                data: {
                                    ...updatePayload,
                                    opmcId,
                                    rtom: item.RTOM || rtom,
                                    soNum: item.SO_NUM,
                                    receivedDate: statusDate,
                                    completedDate: initialSltsStatus === 'COMPLETED' ? statusDate : null,
                                    sltsStatus: initialSltsStatus
                                } as Prisma.ServiceOrderUncheckedCreateInput
                            });
                            created++;
                        }
                    }
                } catch (err) {
                    console.error(`[SYNC] Failed to sync ${item.SO_NUM}:`, err);
                }
            }));
        }

        if (created > 0 || updated > 0) {
            try {
                await addJob(statsUpdateQueue, `stats-${opmcId}`, { opmcId, type: 'SINGLE_OPMC' });
            } catch (queueErr) {
                console.warn(`[SYNC] Failed to queue stats update for OPMC ${opmcId} (Redis offline):`, queueErr);
            }
        }

        if (created > 0) {
            try {
                const { NotificationService } = await import('@/services/notification.service');
                await NotificationService.notifyByRole({
                    roles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'OSP_MANAGER', 'AREA_MANAGER', 'ENGINEER', 'ASSISTANT_ENGINEER', 'AREA_COORDINATOR', 'QC_OFFICER', 'SA_MANAGER', 'SA_ASSISTANT'],
                    title: 'New Service Orders Synced',
                    message: `${created} new pending service orders were synced in the latest portal update.`,
                    type: 'SYSTEM',
                    priority: 'MEDIUM',
                    link: '/service-orders',
                    opmcId,
                    metadata: { count: created, opmcId }
                });
            } catch (err) {
                console.error('[SYNC-NOTIFY] Failed to broadcast new SOD notifications:', err);
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

        const mapping: Partial<Prisma.ServiceOrderUncheckedUpdateInput> = {
            rtom: masterData['RTOM'] || deepData['RTOM'],
            lea: masterData['LEA'],
            voiceNumber: masterData['CIRCUIT'] || masterData['VOICE NUMBER'] || deepData['CIRCUIT'] || masterData['PRIMARY'],
            orderType: masterData['ORDER TYPE'] || deepData['ORDER TYPE'],
            serviceType: masterData['SERVICE TYPE'] || masterData['SERVICE'] || deepData['SERVICE'],
            customerName: masterData['CUSTOMER NAME'] || deepData['CUSTOMER NAME'],
            techContact: masterData['CONTACT NO'] || masterData['CONTACT NUMBER'] || deepData['CONTACT NO'],
            address: masterData['ADDRESS'] || deepData['ADDRESS'],
            status: masterData['STATUS'] || deepData['STATUS'],
            package: masterData['PACKAGE'] || deepData['PACKAGE'],
            iptv: masterData['IPTV'],
            dpDetails: masterData['DP LOOP'] || masterData['DP'] || deepData['DP LOOP'] || masterData['DP_DETAILS'] || masterData['CONNECTION POINT (DP)'],
            sales: masterData['SALES PERSON'] || masterData['SALES'] || deepData['SALES PERSON'],
        };

        let ontVal = masterData['ONT_ROUTER_SERIAL_NUMBER'] || masterData['ONT'] || masterData['SERIAL'];
        const iptvSerials: string[] = [];

        Object.entries(masterData).forEach(([k, v]) => {
            const key = k.toLowerCase();
            const val = String(v).trim();
            if (!val || val.length < 5) return;

            if (key.includes('ont_router_serial') || key === 'ont serial' || (key === 'serial' && !ontVal)) {
                ontVal = val;
            }
            if (key.includes('iptv_cpe_serial') || key.includes('stb serial') || key.includes('iptv serial')) {
                if (!iptvSerials.includes(val)) iptvSerials.push(val);
            }
        });

        if (ontVal) mapping.ontSerialNumber = ontVal;

        const serviceOrder = await prisma.serviceOrder.findUnique({
            where: { soNum },
            include: { materialUsage: true }
        });

        const capturedContractorName = masterData['CON_NAME'] || masterData['CONTRACTOR'] || masterData['CONTRACTOR NAME'] || masterData['CONTRACTOR_NAME'];
        if (capturedContractorName && (!mapping.contractorId || mapping.contractorId === "")) {
            const contractor = await prisma.contractor.findFirst({
                where: { name: { contains: capturedContractorName.trim(), mode: 'insensitive' } }
            });
            if (contractor) mapping.contractorId = contractor.id;
        }

        const isServiceReturn =
            masterData['SERVICE RETURN'] === 'on' ||
            masterData['IS_RETURN'] === 'on' ||
            masterData['CHKSODRTN_HIDDEN'] === 'on' ||
            masterData['CHKSODRTN'] === 'on';

        if (isServiceReturn) {
            mapping.sltsStatus = 'RETURN';
            const rawReason = masterData['RTRESONALL_HIDDEN'] || masterData['SOD RETURN'] || masterData['RETURN REASON'] || 'CUSTOMER NOT READY';
            const classification = SODReturnClassifierService.classify(rawReason);
            mapping.returnReason = classification.category;
            
            const rawComment = masterData['RTCMTALL_HIDDEN'] || masterData['RETURN COMMENT'] || '';
            const combinedComment = `[AI_CLASSIFIED] Reason: ${rawReason}${rawComment ? ` | Comment: ${rawComment}` : ''}`;
            mapping.comments = serviceOrder?.comments ? `${serviceOrder.comments}\n${combinedComment}` : combinedComment;
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
            const opmc = await prisma.oPMC.findFirst({
                where: { rtom: { contains: rtomVal.substring(0, 4), mode: 'insensitive' } }
            });
            opmcId = opmc?.id;
        }
        if (!opmcId) {
            const firstOpmc = await prisma.oPMC.findFirst();
            opmcId = firstOpmc?.id || '';
        }

        const dataToUpdate: Partial<Prisma.ServiceOrderUncheckedUpdateInput> = {
            ...mapping,
            rtom: (mapping.rtom as string) || serviceOrder?.rtom || 'UNKNOWN',
            opmcId,
            updatedAt: new Date(),
        };

        const rcvDate = SodUtils.safeParseDate(masterData['RECEIVED DATE'] || SodUtils.deepParse(masterData)['RECEIVED DATE']);
        if (rcvDate) dataToUpdate.receivedDate = rcvDate;

        const stDate = SodUtils.safeParseDate(masterData['STATUS DATE'] || SodUtils.deepParse(masterData)['STATUS DATE']);
        if (stDate) dataToUpdate.statusDate = stDate;

        const statusStr = typeof mapping.status === 'string' ? mapping.status : '';
        const currentStatus = statusStr.toUpperCase();

        if (mapping.status === SodStatus.COMPLETED || mapping.status === SodStatus.INSTALL_CLOSED || mapping.status === SodStatus.PROV_CLOSED) {
            if (!mapping.sltsStatus) dataToUpdate.sltsStatus = SodStatus.COMPLETED;
            const d = SodUtils.safeParseDate(masterData['COMPLETED DATE'] || masterData['COMPLETED_DATE'] || stDate);
            if (d) dataToUpdate.completedDate = d;
            if (dataToUpdate.completedDate) dataToUpdate.sltsStatus = SodStatus.COMPLETED;
        } else if (SOD_RETURN_STATUSES.includes(currentStatus)) {
            dataToUpdate.sltsStatus = SodStatus.RETURN;
            const rawReason = masterData['RETURN REASON'] || masterData['REJECTION REASON'] || statusStr || 'Returned in external portal';
            const classification = SODReturnClassifierService.classify(rawReason);
            dataToUpdate.returnReason = classification.category;
            dataToUpdate.comments = serviceOrder?.comments 
                ? `${serviceOrder.comments}\n[AI_CLASSIFIED] Reason: ${rawReason}`
                : `[AI_CLASSIFIED] Reason: ${rawReason}`;
        }

        const teamName = (teamDetails?.['SELECTED TEAM'] || masterData['MOBILE_TEAM_DETAILS'] || masterData['TEAM_DETAILS'] || masterData['ASSIGNED_TEAM']) as string | undefined;
        if (teamName) {
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
                            let item = await tx.inventoryItem.findFirst({
                                where: {
                                    OR: [
                                        { code: code ? code.trim().toUpperCase() : undefined },
                                        { name: name ? { equals: name, mode: 'insensitive' } : undefined },
                                        { importAliases: { has: code || "" } },
                                        { importAliases: { has: name || "" } }
                                    ]
                                }
                            });

                            if (!item) {
                                const searchKey = (name || code || "").toUpperCase();
                                let mappedCode = null;
                                for (const [key, val] of Object.entries(MATERIAL_MAP)) {
                                    if (searchKey.includes(key)) { mappedCode = val; break; }
                                }
                                if (mappedCode) item = await tx.inventoryItem.findFirst({ where: { code: mappedCode } });
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
                        const totalSodMaterialCost = usages.reduce((sum, u) => sum + (Number(u.costPrice) * Number(u.quantity)), 0);
                        await LedgerService.logSodConsumption(tx, updated.id, totalSodMaterialCost);
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
                    status: (dataToUpdate.status as string) || 'PENDING',
                    sltsStatus: (dataToUpdate.sltsStatus as string) || 'INPROGRESS',
                    iptvSerials: iptvSerials.length > 0 ? {
                        create: iptvSerials.map(sn => ({ serialNumber: sn }))
                    } : undefined
                }
            });
        }

        // Sync comments list to ServiceOrderComment table if present in payload
        const commentsList = payload.commentsList || [];
        if (syncedOrder && commentsList.length > 0) {
            try {
                for (const c of commentsList) {
                    const parsedDate = c.date ? new Date(c.date) : new Date();
                    const formattedComment = `[Portal Comment by ${c.user || 'Unknown'}]: ${c.comment || ''}`;

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
            } catch (commentErr) {
                console.error('[BRIDGE-SYNC] Failed to sync comments history:', commentErr);
            }
        }

        if (syncedOrder && syncedOrder.sltsStatus !== oldStatus) {
            try {
                const { StatsService } = await import('@/lib/stats.service');
                await StatsService.handleStatusChange(syncedOrder.opmcId, oldStatus, syncedOrder.sltsStatus);

                if (syncedOrder.sltsStatus === 'RETURN') {
                    const { NotificationService } = await import('@/services/notification.service');
                    await NotificationService.notifyByRole({
                        roles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'OSP_MANAGER', 'AREA_MANAGER', 'ENGINEER', 'ASSISTANT_ENGINEER', 'AREA_COORDINATOR', 'QC_OFFICER', 'SA_MANAGER', 'SA_ASSISTANT'],
                        title: 'SOD Returned (Bridge Sync)',
                        message: `Service Order ${syncedOrder.soNum} was marked as RETURN via Extension. Reason: ${mapping.returnReason || 'N/A'}.`,
                        type: 'PROJECT',
                        priority: 'HIGH',
                        link: '/service-orders/return',
                        opmcId: syncedOrder.opmcId,
                        metadata: { soNum: syncedOrder.soNum, id: syncedOrder.id, opmcId: syncedOrder.opmcId }
                    });
                }
            } catch { /* ignore */ }
        }

        const voiceStatus = masterData['VOICE_TEST_RESULT'] || masterData['VOICE TEST'] || null;
        if (forensicAudit && forensicAudit.length > 0 && soNum) {
            await prisma.sODForensicAudit.upsert({
                where: { soNum },
                update: { auditData: forensicAudit as Prisma.InputJsonValue, voiceTestStatus: voiceStatus, updatedAt: new Date() },
                create: { soNum, auditData: forensicAudit as Prisma.InputJsonValue, voiceTestStatus: voiceStatus }
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
                    let item = await prisma.inventoryItem.findFirst({
                        where: {
                            OR: [
                                { code: code ? code.trim().toUpperCase() : undefined },
                                { name: name ? { equals: name, mode: 'insensitive' } : undefined },
                                { importAliases: { has: code || "" } },
                                { importAliases: { has: name || "" } }
                            ]
                        }
                    });

                    if (!item) {
                        const searchKey = (name || code || "").toUpperCase();
                        let mappedCode = null;
                        for (const [key, val] of Object.entries(MATERIAL_MAP)) {
                            if (searchKey.includes(key)) { mappedCode = val; break; }
                        }
                        if (mappedCode) item = await prisma.inventoryItem.findFirst({ where: { code: mappedCode } });
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

        try {
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
        } catch { /* ignore */ }

        return {
            success: true,
            id: syncedOrder?.id,
            soNum: syncedOrder?.soNum,
            message: 'Bridge sync successful.'
        };
    }
}
