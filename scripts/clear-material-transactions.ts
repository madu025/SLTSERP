import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('⚠ STARTING FULL MATERIAL DATA CLEANUP...');

    // 1. Clear Balance Sheets
    await prisma.contractorMaterialBalanceSheet.deleteMany({});
    console.log('✅ Cleared Balance Sheets');

    // 2. Clear SOD Material Usage (Linked to ServiceOrder + InventoryItem)
    await prisma.sODMaterialUsage.deleteMany({});
    console.log('✅ Cleared SOD Material Usage (Used/Wastage)');

    // 3. Clear Returns (Linked to Contractor + Store)
    // Delete Items first due to FK
    await prisma.contractorMaterialReturnItem.deleteMany({});
    await prisma.contractorMaterialReturn.deleteMany({});
    console.log('✅ Cleared Material Returns');

    // 4. Clear Issues (Linked to Contractor + Store)
    // Delete Items first due to FK
    await prisma.contractorMaterialIssueItem.deleteMany({});
    await prisma.contractorMaterialIssue.deleteMany({});
    console.log('✅ Cleared Material Issues (Store -> Contractor)');

    // 5. Clear Contractor Stock (Current Holdings)
    await prisma.contractorStock.deleteMany({});
    console.log('✅ Cleared Contractor Stock Levels');

    // 6. Clear Inventory Store Stock (Optional - usually you want this clear too if resetting)
    // Or just reset to 0? Safety: Delete.
    // Check if InventoryStoreStock exists in schema... usually yes.
    // Assuming it does:
    try {
        const p = prisma as any;
        if (p.inventoryStoreStock) {
            await p.inventoryStoreStock.deleteMany({});
            console.log('✅ Cleared Main Store Stock Levels');
        }
    } catch (e) {
        console.log('ℹ Skipped Store Stock (Table might not exist)');
    }

    // 7. Clear Audit Logs / Transactions if any
    try {
        const p = prisma as any;
        if (p.inventoryTransaction) {
            await p.inventoryTransaction.deleteMany({});
            console.log('✅ Cleared Inventory Transactions/Logs');
        }
    } catch (e) {
        console.log('ℹ Skipped Inventory Transactions');
    }

    console.log('------------------------------------------------');
    console.log('🎉 All Material TRANSACTIONS cleared successfully.');
    console.log('ℹ NOTE: Material Item Names/Codes (Master Data) were KEPT.');
}

main()
    .catch((e) => {
        console.error('❌ Error clearing data:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });

export { };
