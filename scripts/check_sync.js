
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkSyncStatus() {
    try {
        const rawLogs = await prisma.extensionRawData.findMany({
            select: { soNum: true, createdAt: true, activeTab: true }
        });

        const count = rawLogs.length;
        console.log(`Total Raw Logs Found: ${count}`);

        if (count === 0) {
            console.log("No raw logs found to check.");
            return;
        }

        const uniqueRawSoNums = [...new Set(rawLogs.map(l => l.soNum))];
        console.log(`Unique SOs in Raw Logs: ${uniqueRawSoNums.length}`);

        const syncedOrders = await prisma.serviceOrder.findMany({
            where: { soNum: { in: uniqueRawSoNums } },
            include: {
                materialUsage: {
                    include: {
                        item: true
                    }
                },
                forensicAudit: true
            }
        });

        console.log(`Successfully Synced to Core: ${syncedOrders.length}`);

        const syncedSoNums = syncedOrders.map(o => o.soNum);
        const missingSoNums = uniqueRawSoNums.filter(so => !syncedSoNums.includes(so));

        if (missingSoNums.length > 0) {
            console.log(`\nMissing SOs (In Raw but not in Core): ${missingSoNums.length}`);
            console.log(missingSoNums.join(', '));
        }

        // Check for material usage in synced orders
        const ordersWithMaterials = syncedOrders.filter(o => o.materialUsage && o.materialUsage.length > 0);
        console.log(`\nOrders fully synced with Material Usage: ${ordersWithMaterials.length}`);

        // Detail check for specific 52 number
        if (uniqueRawSoNums.length === 52) {
            console.log("\nFound exactly 52 unique SO numbers in raw logs.");
        }

        console.log("\nDetailed Sync Breakdown:");
        syncedOrders.forEach(o => {
            const serials = o.materialUsage?.filter(m => m.serialNumber).map(m => `${m.item?.name}: ${m.serialNumber}`).join(' | ') || 'None';
            console.log(`[${o.soNum}] Materials: ${o.materialUsage?.length || 0} | Serials: ${serials} | SLTS Status: ${o.sltsStatus}`);
        });

    } catch (error) {
        console.error("Error checking sync status:", error);
    } finally {
        await prisma.$disconnect();
    }
}

checkSyncStatus();
