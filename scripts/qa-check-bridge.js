const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
    // Find SODs with CEN202608060089242
    const sods = await p.serviceOrder.findMany({
        where: { soNumber: { contains: 'CEN202608060089242' } },
        select: {
            id: true,
            soNumber: true,
            sltsStatus: true,
            status: true,
            customerName: true,
            rtom: true,
            isManualEntry: true,
            createdAt: true,
            updatedAt: true
        }
    });

    console.log('=== SODs Found ===');
    console.log(JSON.stringify(sods, null, 2));

    // Check extension bridge logs for these SODs
    if (sods.length > 0) {
        const soNums = sods.map(s => s.soNumber);
        
        // Check ExtensionDataLog (bridge raw data)
        try {
            const logs = await p.extensionDataLog.findMany({
                where: { soNumber: { in: soNums } },
                orderBy: { createdAt: 'desc' },
                take: 5,
                select: {
                    id: true,
                    soNumber: true,
                    createdAt: true,
                    rawData: true
                }
            });
            console.log('\n=== Bridge Extension Logs (last 5) ===');
            logs.forEach(l => {
                const raw = l.rawData;
                console.log(`[${l.createdAt.toISOString()}] SO: ${l.soNumber}`);
                console.log(`  Active Tab: ${raw?.activeTab || 'N/A'}`);
                console.log(`  Details keys: ${raw?.details ? Object.keys(raw.details).length : 0}`);
                console.log(`  Materials: ${raw?.materialDetails?.length || 0}`);
                console.log(`  Team: ${raw?.teamDetails ? JSON.stringify(raw.teamDetails['SELECTED TEAM'] || '') : 'N/A'}`);
                console.log(`  History: ${raw?.history?.length || 0} entries`);
                console.log(`  Forensic: ${raw?.forensicAudit?.length || 0} items`);
            });
        } catch (e) {
            console.log('\n=== ExtensionDataLog check ===');
            console.log('Model not available:', e.message?.substring(0, 100));
        }
    }

    // Also check recent bridge sync activity
    try {
        const recentLogs = await p.extensionDataLog.findMany({
            orderBy: { createdAt: 'desc' },
            take: 10,
            select: {
                soNumber: true,
                createdAt: true,
                rawData: true
            }
        });
        console.log('\n=== Last 10 Bridge Syncs (any SOD) ===');
        recentLogs.forEach(l => {
            console.log(`[${l.createdAt.toISOString()}] ${l.soNumber} | Tab: ${l.rawData?.activeTab || '?'} | Materials: ${l.rawData?.materialDetails?.length || 0}`);
        });
    } catch (e) {
        console.log('\nRecent logs check failed:', e.message?.substring(0, 100));
    }

    await p.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
