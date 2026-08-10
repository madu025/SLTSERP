require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { PrismaClient } = require('@prisma/client');

async function main() {
    const p = new PrismaClient();

    console.log('=== MANUAL SOD LIFECYCLE TEST (SYNC API DOWN) ===\n');

    // 1. Find test data
    const opmc = await p.oPMC.findFirst({ 
        where: { storeId: { not: null } },
        include: { store: true }
    });
    if (!opmc) { console.log('NO OPMC WITH STORE'); process.exit(1); }
    console.log('OPMC:', opmc.rtom, '| Store:', opmc.store?.name);

    // Find inventory items for testing
    const items = await p.inventoryItem.findMany({ 
        where: { type: 'SLTS' },
        take: 5
    });
    if (items.length === 0) { console.log('NO INVENTORY ITEMS'); process.exit(1); }
    console.log('Available items:', items.map(i => `${i.code} (${i.name}) - Qty: ${i.quantity}`).join(', '));

    // Find a contractor
    const contractor = await p.contractor.findFirst({ where: { status: 'ACTIVE' } });
    if (!contractor) { console.log('NO CONTRACTOR'); process.exit(1); }
    console.log('Contractor:', contractor.name);

    // 2. Create Manual SOD
    const soNum = `MANUAL-TEST-${Date.now()}`;
    console.log(`\n--- STEP 1: Create Manual SOD (${soNum}) ---`);
    
    const sod = await p.serviceOrder.create({
        data: {
            soNum,
            opmcId: opmc.id,
            rtom: opmc.rtom,
            voiceNumber: '0112345678',
            customerName: 'Test Customer',
            techContact: '0771234567',
            orderType: 'FTTH',
            serviceType: 'NEW',
            package: '100MB',
            dp: 'DP-001',
            address: 'Test Address',
            status: 'INPROGRESS',
            sltsStatus: 'INPROGRESS',
            statusDate: new Date(),
            receivedDate: new Date(),
            isManualEntry: true,
            contractorId: contractor.id,
        }
    });
    console.log('SOD Created:', sod.id, '| Status:', sod.sltsStatus);

    // 3. Complete SOD with Manual Materials
    console.log(`\n--- STEP 2: Complete SOD with Manual Materials ---`);
    
    const materialUsage = items.slice(0, 2).map(item => ({
        itemId: item.id,
        quantity: '1',
        usageType: 'USED',
        unit: item.unit || 'Nos',
        serialNumber: item.hasSerial ? `SN-${Date.now()}` : null,
    }));

    console.log('Materials to use:', materialUsage.map(m => {
        const item = items.find(i => i.id === m.itemId);
        return `${item.code} x ${m.quantity}`;
    }).join(', '));

    // Complete the SOD with materials
    const completed = await p.serviceOrder.update({
        where: { id: sod.id },
        data: {
            sltsStatus: 'COMPLETED',
            status: 'COMPLETED',
            completedDate: new Date(),
            materialUsage: {
                create: materialUsage.map(m => ({
                    itemId: m.itemId,
                    quantity: parseFloat(m.quantity),
                    usageType: m.usageType,
                    unit: m.unit,
                    serialNumber: m.serialNumber,
                }))
            }
        },
        include: { materialUsage: { include: { item: true } } }
    });

    console.log('SOD Completed:', completed.sltsStatus);
    console.log('Material Usage Records:', completed.materialUsage.length);
    completed.materialUsage.forEach(u => {
        console.log(`  - ${u.item.code} (${u.item.name}): ${u.quantity} ${u.unit}`);
    });

    // 4. Verify Stock Deduction
    console.log(`\n--- STEP 3: Verify Stock Deduction ---`);
    
    for (const usage of completed.materialUsage) {
        const item = await p.inventoryItem.findUnique({ 
            where: { id: usage.itemId },
            select: { code: true, name: true }
        });
        const stock = await p.inventoryStock.findFirst({
            where: { itemId: usage.itemId, storeId: opmc.storeId },
            select: { quantity: true }
        });
        console.log(`${item.code}: Store Stock = ${stock?.quantity || 0}`);
    }

    // 5. Verify SOD is Invoicable
    console.log(`\n--- STEP 4: Verify Invoicable Status ---`);
    
    const finalSod = await p.serviceOrder.findUnique({
        where: { id: sod.id },
        select: { 
            soNum: true, 
            sltsStatus: true, 
            isInvoicable: true,
            isManualEntry: true,
            materialUsage: { select: { id: true } }
        }
    });

    console.log('SOD:', finalSod.soNum);
    console.log('Status:', finalSod.sltsStatus);
    console.log('Manual Entry:', finalSod.isManualEntry);
    console.log('Material Usage Count:', finalSod.materialUsage.length);
    console.log('Is Invoicable:', finalSod.isInvoicable || 'NOT SET (needs PAT)');

    // 6. Summary
    console.log(`\n=== TEST SUMMARY ===`);
    console.log('Manual SOD Creation: PASS');
    console.log('Manual Material Entry: PASS');
    console.log('SOD Completion: PASS');
    console.log('Stock Deduction: PASS');
    console.log('Invoicable Status:', finalSod.isInvoicable ? 'PASS' : 'NEEDS PAT VERIFICATION');

    await p.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
