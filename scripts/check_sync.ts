
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function checkSyncStatus() {
    try {
        const rawLogs = await prisma.extensionRawData.findMany({
            select: { soNum: true, createdAt: true }
        });

        const count = rawLogs.length;
        console.log(`Total Raw Logs Found: ${count}`);

        if (count === 0) {
            console.log("No raw logs found to check.");
            return;
        }

        const soNums = rawLogs.map(l => l.soNum);

        const syncedOrders = await prisma.serviceOrder.findMany({
            where: { soNum: { in: soNums } },
            include: {
                materialUsage: true,
                forensicAudit: true
            }
        });

        console.log(`Successfully Synced to Core: ${syncedOrders.length}`);

        // Check for material usage in synced orders
        const ordersWithMaterials = syncedOrders.filter(o => o.materialUsage && o.materialUsage.length > 0);
        console.log(`Orders with Material Usage: ${ordersWithMaterials.length}`);

        // Check for forensic audit
        const ordersWithAudit = syncedOrders.filter(o => o.forensicAudit);
        console.log(`Orders with Forensic Audit: ${ordersWithAudit.length}`);

        // List some details
        console.log("\nSample Sync Details (Last 5):");
        syncedOrders.slice(-5).forEach(o => {
            console.log(`- SO: ${o.soNum} | Materials: ${o.materialUsage?.length || 0} | Status: ${o.sltsStatus}`);
        });

    } catch (error) {
        console.error("Error checking sync status:", error);
    } finally {
        await prisma.$disconnect();
    }
}

checkSyncStatus();
