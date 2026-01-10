// @ts-nocheck
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
    console.log('⚠ STARTING FULL SYSTEM RESET (INVENTORY & MATERIALS)...');

    // Helper to delete and log
    const clearTable = async (modelName) => {
        try {
            if (prisma[modelName]) {
                const result = await prisma[modelName].deleteMany({});
                console.log(`✅ Cleared ${modelName}: ${result.count} records`);
            }
        } catch (e) {
            console.error(`❌ Error clearing ${modelName}: ${e.message}`);
        }
    };

    // --- 1. Transactional / Movement Tables (Children) ---
    await clearTable('contractorMaterialBalanceSheetItem');
    await clearTable('contractorMaterialBalanceSheet');

    await clearTable('sODMaterialUsage');

    await clearTable('contractorMaterialReturnItem');
    await clearTable('contractorMaterialReturn');

    await clearTable('contractorMaterialIssueItem');
    await clearTable('contractorMaterialIssue');

    await clearTable('contractorWastageItem');
    // await clearTable('contractorWastage'); // If exists

    await clearTable('contractorStock');

    await clearTable('inventoryTransactionItem');
    await clearTable('inventoryTransaction');

    await clearTable('gRNItem');
    await clearTable('gRN');

    await clearTable('mRNItem'); // Material Return Note (Main Store)
    await clearTable('mRN');

    await clearTable('stockRequestItem');
    await clearTable('stockRequest');

    // --- 2. Configuration / Stock Tables ---
    await clearTable('inventoryStock'); // Main Store Stock Levels
    await clearTable('materialStandard'); // Standards linked to items

    // --- 3. Master Data ---
    await clearTable('inventoryItem'); // <--- The Main Request

    // Note: We DO NOT delete 'InventoryStore', 'Contractor', 'User' as those are System Entities.

    console.log('------------------------------------------------');
    console.log('🎉 FULL RESET COMPLETE. Inventory & Material Master data cleared.');
    console.log('Stores, Contractors, and Users were preserved.');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
