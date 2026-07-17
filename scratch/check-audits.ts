import { prisma } from '../src/lib/prisma';

async function main() {
  try {
    console.log("=== CHECKING ITASSETAUDIT RECORDS FOR EMPLOYEE 585 ===\n");

    const audits = await prisma.iTAssetAudit.findMany({
      where: {
        OR: [
          { employeeNo: { contains: '585' } },
          { custodianName: { contains: '585' } }
        ]
      },
      orderBy: { createdAt: 'desc' },
      take: 10
    });

    console.log(`Found ${audits.length} ITAssetAudit records containing '585':`);
    audits.forEach((audit, index) => {
      console.log(`[Audit ${index + 1}]`);
      console.log(`- Created At: ${audit.createdAt}`);
      console.log(`- Employee No: ${audit.employeeNo}`);
      console.log(`- Custodian Name: ${audit.custodianName}`);
      console.log(`- Serial Number: ${audit.serialNumber}`);
      console.log(`- Brand / Model: ${audit.brand} / ${audit.model}`);
      console.log(`- Status: ${audit.status}`);
      console.log(`- Is Confirmed: ${audit.isConfirmed}`);
      console.log(`- Is Synced: ${audit.isSynced}`);
      console.log("-----------------------------------------");
    });

    console.log("\n=== CHECKING LATEST ITASSETAUDIT ENTRIES ===\n");
    const latestAudits = await prisma.iTAssetAudit.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5
    });

    console.log(`Latest ${latestAudits.length} ITAssetAudit records:`);
    latestAudits.forEach((audit, index) => {
      console.log(`[Audit ${index + 1}]`);
      console.log(`- Created At: ${audit.createdAt}`);
      console.log(`- Employee No: ${audit.employeeNo}`);
      console.log(`- Custodian Name: ${audit.custodianName}`);
      console.log(`- Serial Number: ${audit.serialNumber}`);
      console.log(`- Brand / Model: ${audit.brand} / ${audit.model}`);
      console.log("-----------------------------------------");
    });

  } catch (error) {
    console.error("Error executing query:", error);
  }
}

main().catch(console.error);
