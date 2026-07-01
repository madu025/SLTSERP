process.env.READ_REPLICA_URL = "";
import { prisma } from '../src/lib/prisma';
import { ServiceOrderService } from '../src/services/sod';
import { SODMaterialService } from '../src/services/sod/sod.material.service';
import { LedgerService } from '../src/services/finance/ledger.service';

async function main() {
    console.log("=== STARTING SOD LIFE-CYCLE INTEGRATION SIMULATION ===");

    // 1. Pick a User or create one to avoid AuditLog constraint failures
    let user = await prisma.user.findFirst();
    let tempUserCreated = false;
    if (!user) {
        console.log("No User found. Creating a temporary User for audit logs...");
        user = await prisma.user.create({
            data: {
                email: `test-user-${Date.now()}@example.com`,
                name: 'Test Auditor',
                passwordHash: 'dummy',
                role: 'SUPER_ADMIN'
            }
        });
        tempUserCreated = true;
    }
    const userId = user.id;
    console.log(`Using User: ${user.name} (ID: ${userId})`);

    // 2. Pick a Service Order in INPROGRESS state or create one
    let serviceOrder = await prisma.serviceOrder.findFirst({
        where: { sltsStatus: 'INPROGRESS' }
    });

    if (!serviceOrder) {
        console.log("No INPROGRESS ServiceOrder found. Creating a temporary one...");
        const opmc = await prisma.oPMC.findFirst() || await prisma.oPMC.create({
            data: { code: 'OPMC-TEMP', name: 'Temp OPMC', rtom: 'COLOMBO' }
        });
        serviceOrder = await prisma.serviceOrder.create({
            data: {
                soNum: `SO-TEST-${Date.now()}`,
                status: 'INPROGRESS',
                sltsStatus: 'INPROGRESS',
                opmcId: opmc.id,
                rtom: 'COLOMBO',
                customerName: 'Test Customer',
                voiceNumber: '0112345678'
            }
        });
    }

    console.log(`Using Service Order: ${serviceOrder.soNum} (ID: ${serviceOrder.id})`);

    // 3. Pick a Contractor or create one, and assign to Service Order
    let contractor = await prisma.contractor.findFirst();
    if (!contractor) {
        console.log("Creating a temporary Contractor...");
        contractor = await prisma.contractor.create({
            data: { name: 'Temp Contractor' }
        });
    }

    // Assign contractor to service order
    await prisma.serviceOrder.update({
        where: { id: serviceOrder.id },
        data: { contractorId: contractor.id }
    });
    console.log(`Assigned Contractor: ${contractor.name} (ID: ${contractor.id})`);

    // 4. Pick or create a Serialized Inventory Item and seed Contractor Stock
    let item = await prisma.inventoryItem.findFirst({
        where: { hasSerial: true }
    });
    let tempItemCreated = false;
    if (!item) {
        console.log("No serialized item found. Creating a temporary serialized InventoryItem...");
        item = await prisma.inventoryItem.create({
            data: { 
                code: `ITEM-TEMP-${Date.now()}`, 
                name: 'Temp Serialized Item', 
                unit: 'Nos', 
                isWastageAllowed: true, 
                costPrice: 100, 
                unitPrice: 150,
                hasSerial: true
            }
        });
        tempItemCreated = true;
    }
    console.log(`Using Inventory Item: ${item.code} - ${item.name} (ID: ${item.id})`);

    // Seed Contractor Stock = 10 units
    await prisma.contractorStock.upsert({
        where: { contractorId_itemId: { contractorId: contractor.id, itemId: item.id } },
        update: { quantity: 10 },
        create: { contractorId: contractor.id, itemId: item.id, quantity: 10 }
    });
    console.log(`Seeded Contractor Stock: 10 units`);

    // Pick or create store for contractor batch stock seeding
    const opmcRecord = await prisma.oPMC.findUnique({
        where: { id: serviceOrder.opmcId },
        include: { store: true }
    });
    const storeId = opmcRecord?.storeId || (await prisma.inventoryStore.findFirst())?.id;
    if (!storeId) {
        throw new Error("No InventoryStore found to seed contractor batch stocks.");
    }

    // Seeding Contractor Batch Stock
    const batch = await prisma.inventoryBatch.create({
        data: {
            batchNumber: `BAT-TEST-${Date.now()}`,
            itemId: item.id,
            initialQty: 10,
            costPrice: 100,
            unitPrice: 150
        }
    });

    await prisma.contractorBatchStock.create({
        data: {
            contractorId: contractor.id,
            batchId: batch.id,
            itemId: item.id,
            quantity: 10
        }
    });
    console.log(`Seeded Contractor Batch Stock: 10 units in batch ${batch.batchNumber}`);

    // Seed 3 serials under contractor custody
    const serialNumbers = [`SN-TEST-1-${Date.now()}`, `SN-TEST-2-${Date.now()}`, `SN-TEST-3-${Date.now()}`];
    for (const sn of serialNumbers) {
        await prisma.inventoryItemSerial.create({
            data: {
                itemId: item.id,
                serialNumber: sn,
                status: 'ISSUED',
                contractorId: contractor.id,
                storeId: null
            }
        });
    }
    console.log(`Seeded 3 serials under contractor: ${serialNumbers.join(', ')}`);

    // ==========================================
    // SIMULATION 1: Transition to COMPLETED (Manual material usage)
    // ==========================================
    console.log("\n--- SIMULATION 1: Completing Service Order ---");
    const materialUsageInput = [
        {
            itemId: item.id,
            quantity: 3,
            usageType: 'USED',
            serialNumber: serialNumbers[0],
            comment: 'Manual Usage'
        }
    ];

    // Call patchServiceOrder (simulating the completion request)
    await ServiceOrderService.patchServiceOrder(
        serviceOrder.id,
        {
            sltsStatus: 'COMPLETED',
            status: 'INSTALL_CLOSED',
            completedDate: new Date(),
            contractorId: contractor.id,
            materialUsage: materialUsageInput
        },
        userId
    );

    // Verify Contractor Stock decreased by 3 units
    const stockAfterCompletion = await prisma.contractorStock.findUnique({
        where: { contractorId_itemId: { contractorId: contractor.id, itemId: item.id } }
    });
    console.log(`Contractor Stock after completion: ${stockAfterCompletion?.quantity} (Expected: 7)`);
    if (Number(stockAfterCompletion?.quantity) !== 7) throw new Error("STOCK_DECREMENT_FAILED");

    // Verify Serial Number status updated to INSTALLED
    const serialRecord = await prisma.inventoryItemSerial.findUnique({
        where: { serialNumber: serialNumbers[0] }
    });
    console.log(`Serial ${serialNumbers[0]} status: ${serialRecord?.status} (Expected: INSTALLED)`);
    if (serialRecord?.status !== 'INSTALLED') throw new Error("SERIAL_STATUS_UPDATE_FAILED");

    // Verify General Ledger Consumption Entries posted
    const usages = await prisma.sODMaterialUsage.findMany({
        where: { serviceOrderId: serviceOrder.id }
    });
    console.log("Material usages created in database:", JSON.stringify(usages, null, 2));

    const allGL = await prisma.journalEntry.findMany();
    console.log("All Journal Entries in DB:", JSON.stringify(allGL, null, 2));

    const glEntries = await prisma.journalEntry.findMany({
        where: { referenceId: serviceOrder.id }
    });
    console.log(`GL Entries posted: ${glEntries.length} entries`);
    if (glEntries.length === 0) throw new Error("GL_POSTING_FAILED");

    // ==========================================
    // SIMULATION 2: Transition to RETURN (Rollback)
    // ==========================================
    console.log("\n--- SIMULATION 2: Returning Service Order ---");
    await ServiceOrderService.patchServiceOrder(
        serviceOrder.id,
        {
            sltsStatus: 'RETURN',
            status: 'RETURNED',
            returnReason: 'Customer Not Ready',
            comments: 'Delays in field installation'
        },
        userId
    );

    // Verify Contractor Stock restored to 10 units
    const stockAfterReturn = await prisma.contractorStock.findUnique({
        where: { contractorId_itemId: { contractorId: contractor.id, itemId: item.id } }
    });
    console.log(`Contractor Stock after return: ${stockAfterReturn?.quantity} (Expected: 10)`);
    if (Number(stockAfterReturn?.quantity) !== 10) throw new Error("STOCK_ROLLBACK_FAILED");

    // Verify Serial Number status reverted to ISSUED under contractor
    const serialRecordReturn = await prisma.inventoryItemSerial.findUnique({
        where: { serialNumber: serialNumbers[0] }
    });
    console.log(`Serial ${serialNumbers[0]} status: ${serialRecordReturn?.status} (Expected: ISSUED)`);
    if (serialRecordReturn?.status !== 'ISSUED') throw new Error("SERIAL_STATUS_ROLLBACK_FAILED");

    // Verify Reversal Journal Entries posted in GL
    const totalEntries = await prisma.journalEntry.findMany({
        where: { referenceId: serviceOrder.id }
    });
    const reversalEntry = totalEntries.find(e => e.referenceType?.includes('REVERSAL'));
    console.log(`GL Reversal Entry found: ${reversalEntry ? 'YES' : 'NO'}`);
    if (!reversalEntry) throw new Error("GL_REVERSAL_FAILED");

    // ==========================================
    // SIMULATION 3: Re-Completing Service Order
    // ==========================================
    console.log("\n--- SIMULATION 3: Re-Completing Service Order ---");
    await ServiceOrderService.patchServiceOrder(
        serviceOrder.id,
        {
            sltsStatus: 'COMPLETED',
            status: 'INSTALL_CLOSED',
            completedDate: new Date(),
            contractorId: contractor.id,
            materialUsage: [
                {
                    itemId: item.id,
                    quantity: 4,
                    usageType: 'USED',
                    serialNumber: serialNumbers[1],
                    comment: 'New Usage'
                }
            ]
        },
        userId
    );

    // Verify Contractor Stock decreased to 6 units
    const stockFinal = await prisma.contractorStock.findUnique({
        where: { contractorId_itemId: { contractorId: contractor.id, itemId: item.id } }
    });
    console.log(`Contractor Stock after final completion: ${stockFinal?.quantity} (Expected: 6)`);
    if (Number(stockFinal?.quantity) !== 6) throw new Error("FINAL_STOCK_DECREMENT_FAILED");

    // ==========================================
    // CLEANUP TEMPORARY RECORDS
    // ==========================================
    console.log("\nCleaning up temporary test records...");
    await prisma.sODMaterialUsage.deleteMany({ where: { serviceOrderId: serviceOrder.id } });
    await prisma.journalLine.deleteMany({ where: { entry: { referenceId: serviceOrder.id } } });
    await prisma.journalEntry.deleteMany({ where: { referenceId: serviceOrder.id } });
    await prisma.inventoryItemSerial.deleteMany({ where: { serialNumber: { in: serialNumbers } } });
    await prisma.contractorBatchStock.deleteMany({ where: { contractorId: contractor.id, itemId: item.id } });
    await prisma.inventoryBatch.delete({ where: { id: batch.id } });

    // If it was a temporary order, delete it
    if (serviceOrder.soNum.startsWith('SO-TEST-')) {
        await prisma.serviceOrder.delete({ where: { id: serviceOrder.id } });
    }

    if (tempItemCreated) {
        await prisma.inventoryItem.delete({ where: { id: item.id } });
    }

    if (tempUserCreated) {
        await prisma.user.delete({ where: { id: userId } });
    }

    console.log("\n=== LIFE-CYCLE INTEGRATION SIMULATION SUCCESSFUL ===");
}

main()
    .catch(err => {
        console.error("Simulation failed with error:", err);
        process.exit(1);
    });
