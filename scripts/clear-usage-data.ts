const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
    console.log('Starting to clear Material Usage and Wastage data...');

    // Delete all records from SODMaterialUsage table
    // This contains both 'USED' and 'WASTAGE' records linked to Service Orders
    const deletedUsage = await prisma.sODMaterialUsage.deleteMany({});

    console.log(`✅ Successfully deleted ${deletedUsage.count} records from SODMaterialUsage table.`);

    // Also clear any generated Balance Sheets to ensure reports are regenerated cleanly
    const deletedSheets = await prisma.contractorMaterialBalanceSheet.deleteMany({});
    console.log(`✅ Cleared ${deletedSheets.count} generated Balance Sheet reports.`);

    console.log('Database tables cleared successfully.');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
