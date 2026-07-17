import { prisma } from '../src/lib/prisma';

async function main() {
  try {
    console.log("=== CHECKING LATEST SYNC LOGS IN DATABASE ===\n");

    const logs = await prisma.assetSyncLog.findMany({
      include: {
        asset: {
          select: {
            serialNumber: true,
            computerName: true,
            osVersion: true,
            ipAddress: true,
            macAddress: true
          }
        }
      },
      orderBy: { syncedAt: 'desc' },
      take: 10
    });

    console.log(`Latest ${logs.length} sync logs:`);
    logs.forEach((log, index) => {
      console.log(`[Log ${index + 1}]`);
      console.log(`- Synced At: ${log.syncedAt}`);
      console.log(`- Reported Employee Number: ${log.reportedEmployeeNumber}`);
      console.log(`- Reported Employee Username: ${log.reportedEmployeeUsername}`);
      console.log(`- Client IP: ${log.ipAddress}`);
      if (log.asset) {
        console.log(`- Asset Serial: ${log.asset.serialNumber}`);
        console.log(`- Computer Name: ${log.asset.computerName}`);
        console.log(`- OS Version: ${log.asset.osVersion}`);
      }
      console.log("-----------------------------------------");
    });

    console.log("\n=== CHECKING LATEST SYNCED ITASSETS ===\n");

    const assets = await prisma.iTAsset.findMany({
      where: {
        lastSyncedAt: { not: null }
      },
      select: {
        id: true,
        assetNumber: true,
        serialNumber: true,
        computerName: true,
        lastSeenEmployeeNumber: true,
        lastSeenEmployeeUsername: true,
        lastSyncedAt: true,
        ipAddress: true,
        macAddress: true
      },
      orderBy: { lastSyncedAt: 'desc' },
      take: 10
    });

    console.log(`Latest ${assets.length} synced assets:`);
    assets.forEach((asset, index) => {
      console.log(`[Asset ${index + 1}]`);
      console.log(`- Serial Number: ${asset.serialNumber}`);
      console.log(`- Computer Name: ${asset.computerName}`);
      console.log(`- Last Synced At: ${asset.lastSyncedAt}`);
      console.log(`- Last Seen Emp No: ${asset.lastSeenEmployeeNumber}`);
      console.log(`- Last Seen Username: ${asset.lastSeenEmployeeUsername}`);
      console.log(`- IP: ${asset.ipAddress}`);
      console.log(`- MAC: ${asset.macAddress}`);
      console.log("-----------------------------------------");
    });

  } catch (error) {
    console.error("Error executing query:", error);
  }
}

main().catch(console.error);
