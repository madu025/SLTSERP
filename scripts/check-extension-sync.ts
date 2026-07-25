import { prisma } from '../src/lib/prisma';

async function checkExtensionSync() {
    const totalCount = await prisma.extensionRawData.count();

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const todayRecords = await prisma.extensionRawData.findMany({
        where: {
            updatedAt: {
                gte: todayStart
            }
        },
        orderBy: {
            updatedAt: 'desc'
        },
        select: {
            id: true,
            soNum: true,
            createdAt: true,
            updatedAt: true,
            sltUser: true,
            activeTab: true
        }
    });

    const latestRecords = await prisma.extensionRawData.findMany({
        take: 10,
        orderBy: {
            updatedAt: 'desc'
        },
        select: {
            id: true,
            soNum: true,
            createdAt: true,
            updatedAt: true,
            sltUser: true,
            activeTab: true
        }
    });

    console.log(`Total ExtensionRawData records in DB: ${totalCount}`);
    console.log(`ExtensionRawData records updated today (${todayStart.toISOString().split('T')[0]}): ${todayRecords.length}`);
    
    if (todayRecords.length > 0) {
        console.log("Today's synced records sample:");
        console.table(todayRecords.slice(0, 10).map(r => ({
            soNum: r.soNum,
            sltUser: r.sltUser,
            activeTab: r.activeTab,
            createdAt: r.createdAt.toISOString(),
            updatedAt: r.updatedAt.toISOString()
        })));
    } else {
        console.log("No ExtensionRawData records synced today.");
    }

    console.log("\nLatest 10 overall records in ExtensionRawData:");
    console.table(latestRecords.map(r => ({
        soNum: r.soNum,
        sltUser: r.sltUser,
        activeTab: r.activeTab,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString()
    })));
}

checkExtensionSync();
