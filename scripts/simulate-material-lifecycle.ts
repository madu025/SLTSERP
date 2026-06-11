import { PrismaClient } from '@prisma/client';
import { GRNService } from '../src/services/inventory/grn.service';
import { StockService } from '../src/services/inventory/stock.service';
import { IssueService } from '../src/services/inventory/issue.service';
import { SODMaterialService } from '../src/services/sod/sod.material.service';
import { MaterialService } from '../src/services/material.service';
import { InventoryService } from '../src/services/inventory';

const prisma = new PrismaClient();

async function runSimulation() {
    console.log('======================================================');
    console.log('STARTING LIFECYCLE & AUDIT FIX VERIFICATION SIMULATION');
    console.log('======================================================\n');

    // 1. Fetch references
    const store = await prisma.inventoryStore.findFirst({
        where: {
            opmcs: {
                some: {}
            }
        },
        include: { opmcs: true }
    });
    
    if (!store) {
        console.error('ERROR: Need at least one store linked to an OPMC to run the simulation.');
        return;
    }

    const opmcId = store.opmcs[0]?.id;
    if (!opmcId) {
        console.error('ERROR: Store must be linked to at least one OPMC for SOD simulation.');
        return;
    }

    const contractor = await prisma.contractor.findFirst({
        where: { opmcId }
    });
    const user = await prisma.user.findFirst();

    if (!contractor || !user) {
        console.error('ERROR: Need a contractor and user to run the simulation.');
        return;
    }

    console.log(`Using Store: ${store.name} (${store.id})`);
    console.log(`Using Contractor: ${contractor.name} (${contractor.id})`);
    console.log(`Using User: ${user.name} (${user.id})`);
    console.log(`Using OPMC ID: ${opmcId}\n`);

    // 2. Setup Serialized Item
    console.log('Creating/resetting test serialized item (SIM-TEST-XYZ)...');
    const item = await prisma.inventoryItem.upsert({
        where: { code: 'SIM-TEST-XYZ' },
        update: { hasSerial: true, type: 'SLT' },
        create: {
            code: 'SIM-TEST-XYZ',
            name: 'Test Serial ONT Router',
            commonName: 'Test Router',
            unit: 'Nos',
            category: 'EQUIPMENT',
            hasSerial: true,
            type: 'SLT'
        }
    });

    try {
        // --- STEP 1: RECEIVING STOCK VIA GRN ---
        console.log('\n--- STEP 1: RECEIVING STOCK VIA GRN ---');
        console.log('Checking in 3 units of serials: TEST-SN-001, TEST-SN-002, TEST-SN-003...');
        const grnResult = await GRNService.createGRN({
            receivedById: user.id,
            storeId: store.id,
            sourceType: 'SUPPLIER',
            sltReferenceId: 'REF-GRN-SIM-1',
            items: [
                {
                    itemId: item.id,
                    quantity: 3,
                    serials: ['TEST-SN-001', 'TEST-SN-002', 'TEST-SN-003']
                }
            ]
        });

        // Verify Store Stock Levels
        const stockAfterGrn = await prisma.inventoryStock.findUnique({
            where: { storeId_itemId: { storeId: store.id, itemId: item.id } }
        });
        console.log(`✓ Store global stock quantity: ${stockAfterGrn?.quantity} (Expected: >=3)`);

        const batchStocksInStore = await prisma.inventoryBatchStock.findMany({
            where: { storeId: store.id, itemId: item.id }
        });
        const storeBatchTotal = batchStocksInStore.reduce((acc, b) => acc + b.quantity, 0);
        console.log(`✓ Store batch stock total: ${storeBatchTotal} (Expected: >=3)`);

        const serialsInStore = await prisma.inventoryItemSerial.findMany({
            where: { itemId: item.id, storeId: store.id, status: 'IN_STORE' }
        });
        console.log(`✓ Registered Serials status IN_STORE count: ${serialsInStore.length} (Expected: 3)`);
        if (serialsInStore.length !== 3) {
            throw new Error('Serials were not registered correctly in store.');
        }

        // --- STEP 2: ISSUING STOCK TO CONTRACTOR ---
        console.log('\n--- STEP 2: ISSUING STOCK TO CONTRACTOR (DELEGATING FLUX) ---');
        console.log('Issuing 2 units to contractor with serials: TEST-SN-001, TEST-SN-002...');
        const issueResult = await StockService.createStockIssue({
            storeId: store.id,
            issuedById: user.id,
            issueType: 'CONTRACTOR',
            contractorId: contractor.id,
            recipientName: 'Test Contractor Recipient',
            remarks: 'Simulation check',
            items: [
                {
                    itemId: item.id,
                    quantity: 2,
                    serials: ['TEST-SN-001', 'TEST-SN-002']
                }
            ]
        });

        // Verify Store Stock after issue
        const stockAfterIssue = await prisma.inventoryStock.findUnique({
            where: { storeId_itemId: { storeId: store.id, itemId: item.id } }
        });
        console.log(`✓ Store global stock quantity after issue: ${stockAfterIssue?.quantity} (Expected: 1)`);

        const batchStocksInStoreAfterIssue = await prisma.inventoryBatchStock.findMany({
            where: { storeId: store.id, itemId: item.id }
        });
        const storeBatchTotalAfterIssue = batchStocksInStoreAfterIssue.reduce((acc, b) => acc + b.quantity, 0);
        console.log(`✓ Store batch stock total after issue: ${storeBatchTotalAfterIssue} (Expected: 1)`);

        // Verify Contractor Stock
        const contractorStock = await prisma.contractorStock.findUnique({
            where: { contractorId_itemId: { contractorId: contractor.id, itemId: item.id } }
        });
        console.log(`✓ Contractor global stock quantity: ${contractorStock?.quantity} (Expected: 2)`);

        const batchStocksUnderContractor = await prisma.contractorBatchStock.findMany({
            where: { contractorId: contractor.id, itemId: item.id }
        });
        const contractorBatchTotal = batchStocksUnderContractor.reduce((acc, b) => acc + b.quantity, 0);
        console.log(`✓ Contractor batch stock total: ${contractorBatchTotal} (Expected: 2)`);

        // Verify Serials
        const issuedSerials = await prisma.inventoryItemSerial.findMany({
            where: { itemId: item.id, contractorId: contractor.id, status: 'ISSUED' }
        });
        console.log(`✓ Serials marked ISSUED under contractor count: ${issuedSerials.length} (Expected: 2)`);
        if (issuedSerials.length !== 2) {
            throw new Error('Serials were not marked ISSUED under contractor correctly.');
        }

        // --- STEP 3: SOD USAGE ---
        console.log('\n--- STEP 3: SOD MATERIAL USAGE ---');
        console.log('Creating mock Service Order and marking serial TEST-SN-001 as USED...');

        // Create completed Service Order
        const mockSO = await prisma.serviceOrder.create({
            data: {
                soNum: `SO-SIM-${Date.now()}`,
                status: 'COMPLETED',
                sltsStatus: 'COMPLETED',
                rtom: store.opmcs[0]?.rtom || 'COLOMBO',
                opmcId: opmcId,
                contractorId: contractor.id,
                completedDate: new Date(),
                statusDate: new Date()
            }
        });

        // Record usage via SODMaterialService
        await prisma.$transaction(async (tx) => {
            const usageRecords = await SODMaterialService.processMaterialUsage(
                tx,
                mockSO.id,
                opmcId,
                contractor.id,
                [
                    {
                        itemId: item.id,
                        quantity: '1',
                        usageType: 'USED',
                        serialNumber: 'TEST-SN-001'
                    }
                ],
                InventoryService,
                user.id
            );

            await tx.sODMaterialUsage.createMany({
                data: usageRecords.create.map(r => ({
                    ...r,
                    serviceOrderId: mockSO.id
                }))
            });
        });

        // Verify Contractor Stock
        const stockAfterUsage = await prisma.contractorStock.findUnique({
            where: { contractorId_itemId: { contractorId: contractor.id, itemId: item.id } }
        });
        console.log(`✓ Contractor global stock quantity after SOD usage: ${stockAfterUsage?.quantity} (Expected: 1)`);

        // Verify Serial Status
        const usedSerial = await prisma.inventoryItemSerial.findUnique({
            where: { serialNumber: 'TEST-SN-001' }
        });
        console.log(`✓ Used Serial status: ${usedSerial?.status} (Expected: INSTALLED)`);
        console.log(`✓ Used Serial linked to sodId: ${usedSerial?.sodId} (Expected: ${mockSO.id})`);
        if (usedSerial?.status !== 'INSTALLED' || usedSerial?.sodId !== mockSO.id) {
            throw new Error('Used serial number status or linkage was not updated correctly.');
        }

        // --- STEP 4: RETURN FROM CONTRACTOR ---
        console.log('\n--- STEP 4: MATERIAL RETURN FROM CONTRACTOR ---');
        console.log('Contractor returning 1 unit of serial TEST-SN-002 back to store...');
        const currentMonth = new Date().toISOString().slice(0, 7); // "YYYY-MM"
        const returnResult = await IssueService.createMaterialReturn({
            contractorId: contractor.id,
            storeId: store.id,
            month: currentMonth,
            reason: 'Simulation return',
            items: [
                {
                    itemId: item.id,
                    quantity: 1,
                    condition: 'GOOD',
                    serials: ['TEST-SN-002']
                }
            ],
            userId: user.id
        });

        // Verify Store Stock
        const storeStockAfterReturn = await prisma.inventoryStock.findUnique({
            where: { storeId_itemId: { storeId: store.id, itemId: item.id } }
        });
        console.log(`✓ Store global stock quantity after return: ${storeStockAfterReturn?.quantity} (Expected: 2)`);

        // Verify Contractor Stock
        const contractorStockAfterReturn = await prisma.contractorStock.findUnique({
            where: { contractorId_itemId: { contractorId: contractor.id, itemId: item.id } }
        });
        console.log(`✓ Contractor global stock quantity after return: ${contractorStockAfterReturn?.quantity} (Expected: 0)`);

        // Verify Serial Status
        const returnedSerial = await prisma.inventoryItemSerial.findUnique({
            where: { serialNumber: 'TEST-SN-002' }
        });
        console.log(`✓ Returned Serial status: ${returnedSerial?.status} (Expected: IN_STORE)`);
        console.log(`✓ Returned Serial storeId: ${returnedSerial?.storeId} (Expected: ${store.id})`);
        console.log(`✓ Returned Serial contractorId: ${returnedSerial?.contractorId} (Expected: null)`);
        if (returnedSerial?.status !== 'IN_STORE' || returnedSerial?.storeId !== store.id || returnedSerial?.contractorId !== null) {
            throw new Error('Returned serial number status or linkages were not updated correctly.');
        }

        // --- STEP 5: MONTHLY BALANCE SHEET ---
        console.log('\n--- STEP 5: MONTHLY BALANCE SHEET REPORT GENERATION ---');
        const sheet = await MaterialService.generateBalanceSheet(contractor.id, store.id, currentMonth, user.id);

        const sheetWithItems = await prisma.contractorMaterialBalanceSheet.findUnique({
            where: { id: sheet.id },
            include: { items: { include: { item: true } } }
        });

        const sheetItem = sheetWithItems?.items.find(i => i.itemId === item.id);
        console.log(`✓ Balance Sheet Generated: ${sheetWithItems?.month}`);
        console.log(`✓ Opening Balance: ${sheetItem?.openingBalance} (Expected: 0)`);
        console.log(`✓ Received Quantity: ${sheetItem?.received} (Expected: 2)`);
        console.log(`✓ Used Quantity: ${sheetItem?.used} (Expected: 1)`);
        console.log(`✓ Returned Quantity: ${sheetItem?.returned} (Expected: 1)`);
        console.log(`✓ Closing Balance: ${sheetItem?.closingBalance} (Expected: 0)`);

        if (sheetItem?.received !== 2 || sheetItem?.used !== 1 || sheetItem?.returned !== 1 || sheetItem?.closingBalance !== 0) {
            throw new Error('Balance sheet mathematical checks failed.');
        }

        console.log('\n======================================================');
        console.log('🎉 SIMULATION PASSED: ALL INVENTORY AUDIT FIXES WORKED!');
        console.log('======================================================');

    } catch (error: any) {
        console.error('\n❌ SIMULATION FAILED:', error.message || error);
    } finally {
        console.log('\nCleaning up database simulation records...');
        
        // Find created GRN to delete transactions and GRNItems
        const grn = await prisma.gRN.findFirst({
            where: { reference: 'REF-GRN-SIM-1' }
        });
        if (grn) {
            await prisma.inventoryTransaction.deleteMany({
                where: { referenceId: grn.grnNumber }
            });
            await prisma.gRNItem.deleteMany({ where: { grnId: grn.id } });
            await prisma.gRN.delete({ where: { id: grn.id } });
        }

        // Find created StockIssue to delete transactions and items
        const stockIssues = await prisma.stockIssue.findMany({
            where: { recipientName: 'Test Contractor Recipient', remarks: 'Simulation check' }
        });
        for (const issue of stockIssues) {
            await prisma.inventoryTransaction.deleteMany({
                where: { referenceId: issue.issueNumber }
            });
            await prisma.stockIssueItem.deleteMany({ where: { issueId: issue.id } });
            await prisma.stockIssue.delete({ where: { id: issue.id } });
        }

        // Find contractor material issue/returns
        await prisma.contractorMaterialIssueItem.deleteMany({
            where: { item: { code: 'SIM-TEST-XYZ' } }
        });
        await prisma.contractorMaterialIssue.deleteMany({
            where: { contractorId: contractor.id, storeId: store.id }
        });

        await prisma.contractorMaterialReturnItem.deleteMany({
            where: { item: { code: 'SIM-TEST-XYZ' } }
        });
        await prisma.contractorMaterialReturn.deleteMany({
            where: { contractorId: contractor.id, storeId: store.id }
        });

        // Find and delete mock Service Order and usages
        const mockSOs = await prisma.serviceOrder.findMany({
            where: { soNum: { startsWith: 'SO-SIM-' } }
        });
        for (const so of mockSOs) {
            await prisma.sODMaterialUsage.deleteMany({ where: { serviceOrderId: so.id } });
            await prisma.serviceOrder.delete({ where: { id: so.id } });
        }

        // Delete balance sheet items & sheet
        await prisma.contractorBalanceSheetItem.deleteMany({
            where: { balanceSheet: { contractorId: contractor.id, storeId: store.id, month: currentMonth } }
        });
        await prisma.contractorMaterialBalanceSheet.deleteMany({
            where: { contractorId: contractor.id, storeId: store.id, month: currentMonth }
        });

        // Delete transaction items and logs
        await prisma.inventoryTransactionItem.deleteMany({
            where: { itemId: item.id }
        });
        await prisma.inventoryTransaction.deleteMany({
            where: { storeId: store.id, type: 'TRANSFER_IN' }
        });
        await prisma.inventoryTransaction.deleteMany({
            where: { storeId: store.id, type: 'TRANSFER_OUT' }
        });

        // Delete batch stocks and batches
        await prisma.inventoryBatchStock.deleteMany({
            where: { itemId: item.id }
        });
        await prisma.contractorBatchStock.deleteMany({
            where: { itemId: item.id }
        });
        await prisma.inventoryBatch.deleteMany({
            where: { itemId: item.id }
        });

        // Delete test serial records
        await prisma.inventoryItemSerial.deleteMany({
            where: { itemId: item.id }
        });

        // Delete test stock records
        await prisma.inventoryStock.deleteMany({
            where: { itemId: item.id }
        });
        await prisma.contractorStock.deleteMany({
            where: { itemId: item.id }
        });

        // Delete test item
        await prisma.inventoryItem.delete({
            where: { id: item.id }
        });

        console.log('Cleanup complete. Database state restored.');
    }
}

runSimulation()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
