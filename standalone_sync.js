const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function standaloneSync() {
    console.log('--- Standalone PAT Sync Start ---');
    const url = 'https://serviceportal.slt.lk/iShamp/contr/dynamic_load.php?x=patsuccess&con=SLTS';

    try {
        console.log(`Fetching data from SLT API...`);
        const response = await fetch(url, {
            headers: {
                'Accept': 'application/json, text/plain, */*',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            },
            signal: AbortSignal.timeout(300000)
        });

        if (!response.ok) {
            console.error(`API Error: ${response.status}`);
            return;
        }

        const data = await response.json();
        const apiData = Array.isArray(data.data) ? data.data : [];
        console.log(`Fetched ${apiData.length} records.`);

        if (apiData.length === 0) return;

        // Filter and process
        // For testing/manual trigger, let's take a sample or all
        const batchSize = 1000;
        let totalCached = 0;

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

            const result = await prisma.sLTPATStatus.createMany({
                data: cacheData,
                skipDuplicates: true
            });
            totalCached += result.count;

            // Also update any that were previously REJECTED but are now PASSED
            const soNums = batch.map(b => b.SO_NUM);
            await prisma.sLTPATStatus.updateMany({
                where: { soNum: { in: soNums }, status: { not: 'PAT_PASSED' } },
                data: { status: 'PAT_PASSED', source: 'HO_APPROVED', updatedAt: new Date() }
            });

            console.log(`Progress: ${Math.min(i + batchSize, apiData.length)} / ${apiData.length} indexed...`);

            // Limit to 5000 for initial test to avoid long hang in this tool? 
            // Better to do all if possible but maybe let's notify user.
            if (totalCached > 10000) {
                console.log('Stopping at 10,000 for safety. Run again if more needed.');
                break;
            }
        }

        console.log(`Done. Total Cached: ${totalCached}`);

    } catch (e) {
        console.error('Error:', e.message);
    } finally {
        await prisma.$disconnect();
    }
}

standaloneSync();
