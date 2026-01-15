const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Historical PAT Sync Script
 * Fetches data month by month starting from 2025-01-01
 */
async function syncHistoricalData() {
    console.log('--- Starting Historical PAT Sync (Month-by-Month) ---');
    const baseUrl = 'https://serviceportal.slt.lk/iShamp/contr/dynamic_load.php';

    // Start from 2025-01
    const months = [
        '2025-01', '2025-02', '2025-03', '2025-04', '2025-05', '2025-06',
        '2025-07', '2025-08', '2025-09', '2025-10', '2025-11', '2025-12',
        '2026-01'
    ];

    for (const month of months) {
        console.log(`\n[${month}] Fetching data...`);
        const url = `${baseUrl}?x=patsuccess&y=${month}&con=SLTS`;

        try {
            const response = await fetch(url, {
                headers: {
                    'Accept': 'application/json, text/plain, */*',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                },
                signal: AbortSignal.timeout(120000)
            });

            if (!response.ok) {
                console.error(`[${month}] API Error: ${response.status}`);
                continue;
            }

            const data = await response.json();
            const apiData = Array.isArray(data.data) ? data.data : [];
            console.log(`[${month}] Received ${apiData.length} records.`);

            if (apiData.length === 0) continue;

            const batchSize = 1000;
            let monthCached = 0;
            let monthUpdated = 0;

            for (let i = 0; i < apiData.length; i += batchSize) {
                const batch = apiData.slice(i, i + batchSize);
                const cacheData = batch.map(app => {
                    let sDate = null;
                    if (app.CON_STATUS_DATE) {
                        try { sDate = new Date(app.CON_STATUS_DATE); } catch (e) { }
                    }
                    return {
                        soNum: app.SO_NUM,
                        status: 'PAT_PASSED',
                        source: 'HO_APPROVED',
                        rtom: app.RTOM || '',
                        lea: app.LEA || '',
                        voiceNumber: app.VOICENUMBER || '',
                        sType: app.S_TYPE || '',
                        orderType: app.ORDER_TYPE || '',
                        task: app.CON_WORO_TASK_NAME || '',
                        package: app.PKG || '',
                        conName: app.CON_NAME || '',
                        patUser: app.PAT_USER || '',
                        statusDate: sDate && !isNaN(sDate.getTime()) ? sDate : new Date()
                    };
                });

                // 1. Cache to SLTPATStatus
                const result = await prisma.sLTPATStatus.createMany({
                    data: cacheData,
                    skipDuplicates: true
                });
                monthCached += result.count;

                // 2. Link to existing ServiceOrders
                const soNums = batch.map(b => b.SO_NUM);
                const ordersToUpdate = await prisma.serviceOrder.findMany({
                    where: {
                        soNum: { in: soNums },
                        hoPatStatus: { not: 'PAT_PASSED' }
                    }
                });

                for (const order of ordersToUpdate) {
                    const match = batch.find(b => b.SO_NUM === order.soNum);
                    if (match) {
                        let sDate = null;
                        if (match.CON_STATUS_DATE) {
                            try { sDate = new Date(match.CON_STATUS_DATE); } catch (e) { }
                        }
                        await prisma.serviceOrder.update({
                            where: { id: order.id },
                            data: {
                                hoPatStatus: 'PAT_PASSED',
                                hoPatDate: sDate && !isNaN(sDate.getTime()) ? sDate : new Date(),
                                opmcPatStatus: 'PAT_PASSED',
                                isInvoicable: order.sltsPatStatus === 'PAT_PASSED'
                            }
                        });
                        monthUpdated++;
                    }
                }

                console.log(`[${month}] Progress: ${Math.min(i + batchSize, apiData.length)} / ${apiData.length} indexed...`);
            }
            console.log(`[${month}] Done. Cached: ${monthCached}, Updated SOs: ${monthUpdated}`);

        } catch (e) {
            console.error(`[${month}] Error: ${e.message}`);
        }
    }

    console.log('\n--- Historical Sync Completed ---');
}

syncHistoricalData()
    .catch(err => console.error('Global Error:', err))
    .finally(() => prisma.$disconnect());
