
import { prisma } from '../src/lib/prisma';
import { ServiceOrderService } from '../src/services/sod.service';
import { SODMaterialService } from '../src/services/sod/sod.material.service';
import { InventoryService } from '../src/services/inventory.service';

const testRollback = async () => {
    console.log("🚀 Starting SOD Material Rollback Verification...");

    try {
        // 1. SETUP: Find resources
        const opmc = await prisma.oPMC.findFirst({ include: { store: true } });
        if (!opmc || !opmc.storeId) throw new Error("No OPMC with store found");
        
        const item = await prisma.inventoryItem.findFirst();
        if (!item) throw new Error("No Item found");

        const testUser = await prisma.user.findFirst();
        if (!testUser) throw new Error("No User found");

        console.log(`✅ Using OPMC: ${opmc.name}, Item: ${item.name}`);

        // Ensure store has stock
        await prisma.inventoryStock.upsert({
            where: { storeId_itemId: { storeId: opmc.storeId, itemId: item.id } },
            update: { quantity: { increment: 100 } },
            create: { storeId: opmc.storeId, itemId: item.id, quantity: 100 }
        });
        
        // Also ensure a batch exists for FIFO
        const batch = await prisma.inventoryBatch.create({
            data: {
                itemId: item.id,
                batchNr: `TEST-BATCH-${Date.now()}`,
                mfd: new Date(),
                exp: new Date(Date.now() + 1000 * 60 * 60 * 24 * 365),
                costPrice: 10.5,
                unitPrice: 15.0,
                stocks: {
                    create: { storeId: opmc.storeId, quantity: 50 }
                }
            }
        });

        console.log(`✅ Test Batch created: ${batch.batchNr}`);

        // 2. CREATE SOD
        const sod = await prisma.serviceOrder.create({
            data: {
                soNum: `TEST-SO-${Date.now()}`,
                opmcId: opmc.id,
                status: 'PROJECT_PENDING',
                date: new Date()
            }
        });
        console.log(`✅ SOD Created: ${sod.soNum}`);

        // 3. APPLY MATERIAL USAGE
        console.log("Step 3: Applying Material Usage...");
        const initialUsage = [
            { itemId: item.id, quantity: '10', usageType: 'USED', remarks: 'Rollback test' }
        ];

        await ServiceOrderService.patchServiceOrder(sod.id, { materialUsage: initialUsage } as any, testUser.id);
        
        // Verify stock deducted
        const stockAfterUsed = await prisma.inventoryBatchStock.findUnique({
            where: { storeId_batchId: { storeId: opmc.storeId, batchId: batch.id } }
        });
        console.log(`📊 Stock after usage: ${stockAfterUsed?.quantity} (Original: 50, Used: 10)`);
        if (stockAfterUsed?.quantity !== 40) throw new Error("Stock deduction failed");

        // 4. TRIGGER ROLLBACK (Change status to RETURN)
        console.log("\nStep 4: Triggering Rollback (Status -> RETURN)...");
        await ServiceOrderService.patchServiceOrder(sod.id, { sltsStatus: 'RETURN' } as any, testUser.id);

        // 5. VERIFY STOCK RESTORED
        const stockAfterRollback = await prisma.inventoryBatchStock.findUnique({
            where: { storeId_batchId: { storeId: opmc.storeId, batchId: batch.id } }
        });
        console.log(`📊 Stock after rollback: ${stockAfterRollback?.quantity}`);
        if (stockAfterRollback?.quantity !== 50) throw new Error("Stock rollback failed!");

        // 6. VERIFY TRANSACTION LOGS
        const logs = await prisma.inventoryTransaction.findMany({
            where: { referenceId: sod.id },
            orderBy: { createdAt: 'desc' }
        });
        console.log(`✅ Transaction logs found: ${logs.length}`);
        logs.forEach(l => console.log(`   - [${l.type}] ${l.notes}`));

        console.log("\n🎉 ROLLBACK VERIFICATION PASSED SUCCESSFULLY!");

    } catch (error) {
        console.error("\n❌ VERIFICATION FAILED:", error);
    } finally {
        await prisma.$disconnect();
    }
};

testRollback();
