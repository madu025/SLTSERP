import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { sltApiService, SLTServiceOrderData, SLTPATData } from '../slt-api.service';
import { addJob, statsUpdateQueue, sodSyncQueue } from '../../lib/queue';

interface SyncStats {
    queuedCount: number;
    jobIds: string[];
    lastSyncTriggered: string;
    created: number;
    updated: number;
    failed: number;
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
                select: { id: true, soNum: true, sltsPatStatus: true }
            });

            for (const order of matchingOrders) {
                const match = sltData.find(item => item.SO_NUM === order.soNum);
                if (match) {
                    const status = match.CON_STATUS;
                    await prisma.serviceOrder.update({
                        where: { id: order.id },
                        data: {
                            opmcPatStatus: status,
                            opmcPatDate: sltApiService.parseStatusDate(match.CON_STATUS_DATE),
                            isInvoicable: order.sltsPatStatus === 'PAT_PASSED'
                        }
                    });
                }
            }

            if (matchingOrders.length > 0) {
                await addJob(statsUpdateQueue, `stats-${opmcId}`, {
                    opmcId,
                    type: 'SINGLE_OPMC'
                });
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
            const filterDate = lastSyncSetting ? new Date(lastSyncSetting.value as string) : new Date('2026-01-01');

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

            const batchSize = 1000;
            let totalCached = 0;
            let totalUpdated = 0;

            for (let i = 0; i < filteredData.length; i += batchSize) {
                const batch = filteredData.slice(i, i + batchSize);
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
                    statusDate: sltApiService.parseStatusDate(app.CON_STATUS_DATE) as Date
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

                for (const order of ordersToUpdate) {
                    const match = batch.find((b: SLTPATData) => b.SO_NUM === order.soNum);
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
                await addJob(statsUpdateQueue, `stats-${opmc.id}`, { opmcId: opmc.id, type: 'SINGLE_OPMC' });
            }

            return { totalCached, totalUpdated };
        } catch (err) {
            console.error('[PAT-SYNC] HO Approved Sync Failed:', err);
            return { totalCached: 0, totalUpdated: 0, error: String(err) };
        }
    }

    /**
     * Trigger sync for all OPMCs
     */
    static async syncAllOpmcs() {
        const opmcs = await prisma.oPMC.findMany({ select: { id: true, rtom: true }, orderBy: { rtom: 'asc' } });
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
                    const initialSltsStatus = completionStatuses.includes(item.CON_STATUS) ? 'COMPLETED' : 'INPROGRESS';

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
                        sltsStatus: initialSltsStatus
                    };

                    if (existing) {
                        const isRestoring = (existing.sltsStatus === 'RETURN' && initialSltsStatus === 'INPROGRESS');
                        await prisma.serviceOrder.update({
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
            await addJob(statsUpdateQueue, `stats-${opmcId}`, { opmcId, type: 'SINGLE_OPMC' });
        }

        return { created, updated };
    }
}
