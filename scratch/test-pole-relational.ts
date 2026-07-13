import { prisma } from '../src/lib/prisma';
import { ServiceOrderService } from '../src/services/sod';

async function runTest() {
    console.log('--- Starting Relational Pole Database Test ---');

    // 1. Get an existing service order to test with
    const testOrder = await prisma.serviceOrder.findFirst({
        orderBy: { createdAt: 'desc' }
    });

    if (!testOrder) {
        console.error('No service order found in database to test with!');
        return;
    }

    console.log(`Found test Service Order: ID=${testOrder.id}, SO_NUM=${testOrder.soNum}`);

    // Get a valid user for audit logging
    const user = await prisma.user.findFirst();
    if (!user) {
        console.error('No user found in database.');
        return;
    }
    const userId = user.id;

    // Get a contractor to assign if needed
    let contractorId = testOrder.contractorId;
    if (!contractorId) {
        const contractor = await prisma.contractor.findFirst();
        if (contractor) contractorId = contractor.id;
    }

    // 2. Perform completion/patch with two erected poles
    console.log('\n[TEST 1] Patching order with 2 erected poles...');
    const patchPayload = {
        sltsStatus: 'COMPLETED' as const,
        completedDate: new Date().toISOString(),
        contractorId,
        erectedPoles: [
            { poleType: 'PLC-5_6-CE', poleNumber: 'TEST-POLE-56' },
            { poleType: 'PLC-6_7-CE', poleNumber: 'TEST-POLE-67' }
        ]
    };

    try {
        await ServiceOrderService.patchServiceOrder(testOrder.id, patchPayload, userId);
        console.log('Successfully patched service order!');

        // Query database to verify poles were created
        const poles = await prisma.sODErectedPole.findMany({
            where: { serviceOrderId: testOrder.id }
        });

        console.log(`Poles found in database: ${poles.length}`);
        poles.forEach((p, idx) => {
            console.log(` [${idx + 1}] Type: ${p.poleType}, Serial: ${p.poleNumber}`);
        });

        if (poles.length === 2) {
            console.log('✅ PASS: Successfully created 2 relational pole records!');
        } else {
            console.log('❌ FAIL: Incorrect number of pole records created.');
        }

        // 3. Test update/replacement
        console.log('\n[TEST 2] Updating order with 1 pole to verify clean overwrite...');
        const updatePayload = {
            sltsStatus: 'COMPLETED' as const,
            completedDate: new Date().toISOString(),
            contractorId,
            erectedPoles: [
                { poleType: 'PLC-8', poleNumber: 'TEST-POLE-80' }
            ]
        };

        await ServiceOrderService.patchServiceOrder(testOrder.id, updatePayload, userId);
        
        const updatedPoles = await prisma.sODErectedPole.findMany({
            where: { serviceOrderId: testOrder.id }
        });

        console.log(`Poles found after update: ${updatedPoles.length}`);
        updatedPoles.forEach((p, idx) => {
            console.log(` [${idx + 1}] Type: ${p.poleType}, Serial: ${p.poleNumber}`);
        });

        if (updatedPoles.length === 1 && updatedPoles[0].poleNumber === 'TEST-POLE-80') {
            console.log('✅ PASS: Overnight/update deleted previous records and created new ones successfully!');
        } else {
            console.log('❌ FAIL: Relational overwrite failed.');
        }

        // 4. Test unique constraint validation (Duplicate detection)
        console.log('\n[TEST 3] Inserting duplicate pole number to verify database constraint...');
        
        // Find another service order
        const otherOrder = await prisma.serviceOrder.findFirst({
            where: { id: { not: testOrder.id } }
        });

        if (otherOrder) {
            console.log(`Attempting to assign duplicate serial 'TEST-POLE-80' to another order ID=${otherOrder.id}...`);
            const duplicatePayload = {
                sltsStatus: 'COMPLETED' as const,
                completedDate: new Date().toISOString(),
                contractorId: otherOrder.contractorId || contractorId,
                erectedPoles: [
                    { poleType: 'PLC-5_6-CE', poleNumber: 'TEST-POLE-80' } // Same serial number!
                ]
            };

            try {
                await ServiceOrderService.patchServiceOrder(otherOrder.id, duplicatePayload, userId);
                console.log('❌ FAIL: Database allowed creating duplicate pole numbers.');
            } catch (err: any) {
                console.log('✅ PASS: Threw exception as expected! Error message:', err.message || err);
            }
        } else {
            console.log('Skipping Duplicate check (only 1 order in DB).');
        }

        // 5. Clean up test data
        console.log('\nCleaning up test poles...');
        await prisma.sODErectedPole.deleteMany({
            where: {
                poleNumber: { in: ['TEST-POLE-56', 'TEST-POLE-67', 'TEST-POLE-80'] }
            }
        });
        console.log('Clean up done.');

    } catch (err) {
        console.error('Error during testing:', err);
        // clean up
        await prisma.sODErectedPole.deleteMany({
            where: {
                poleNumber: { in: ['TEST-POLE-56', 'TEST-POLE-67', 'TEST-POLE-80'] }
            }
        });
    }
}

runTest()
    .then(() => prisma.$disconnect())
    .catch((err) => {
        console.error(err);
        prisma.$disconnect();
    });
