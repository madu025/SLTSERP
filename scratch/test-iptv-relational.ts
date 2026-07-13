import { prisma } from '../src/lib/prisma';
import { ServiceOrderService } from '../src/services/sod';

async function runTest() {
    console.log('--- Starting Relational IPTV Serial Database Test ---');

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

    // 2. Perform completion/patch with two IPTV serials
    console.log('\n[TEST 1] Patching order with 2 IPTV serials...');
    const patchPayload = {
        sltsStatus: 'COMPLETED' as const,
        completedDate: new Date().toISOString(),
        contractorId,
        iptvSerialNumbers: ['IPTV-TEST-STB1', 'IPTV-TEST-STB2']
    };

    try {
        await ServiceOrderService.patchServiceOrder(testOrder.id, patchPayload, userId);
        console.log('Successfully patched service order!');

        // Query database to verify IPTV serials were created
        const serials = await prisma.sODIptvSerial.findMany({
            where: { serviceOrderId: testOrder.id }
        });

        console.log(`IPTV serials found in database: ${serials.length}`);
        serials.forEach((s, idx) => {
            console.log(` [${idx + 1}] Serial: ${s.serialNumber}`);
        });

        if (serials.length === 2) {
            console.log('✅ PASS: Successfully created 2 relational IPTV serial records!');
        } else {
            console.log('❌ FAIL: Incorrect number of IPTV records created.');
        }

        // 3. Test update/replacement
        console.log('\n[TEST 2] Updating order with 1 IPTV serial to verify clean overwrite...');
        const updatePayload = {
            sltsStatus: 'COMPLETED' as const,
            completedDate: new Date().toISOString(),
            contractorId,
            iptvSerialNumbers: ['IPTV-TEST-STB3']
        };

        await ServiceOrderService.patchServiceOrder(testOrder.id, updatePayload, userId);
        
        const updatedSerials = await prisma.sODIptvSerial.findMany({
            where: { serviceOrderId: testOrder.id }
        });

        console.log(`IPTV serials found after update: ${updatedSerials.length}`);
        updatedSerials.forEach((s, idx) => {
            console.log(` [${idx + 1}] Serial: ${s.serialNumber}`);
        });

        if (updatedSerials.length === 1 && updatedSerials[0].serialNumber === 'IPTV-TEST-STB3') {
            console.log('✅ PASS: Relational overwrite deleted previous records and created new ones successfully!');
        } else {
            console.log('❌ FAIL: Relational overwrite failed.');
        }

        // 4. Test unique constraint validation (Duplicate detection)
        console.log('\n[TEST 3] Inserting duplicate IPTV serial number to verify database constraint...');
        
        // Find another service order
        const otherOrder = await prisma.serviceOrder.findFirst({
            where: { id: { not: testOrder.id } }
        });

        if (otherOrder) {
            console.log(`Attempting to assign duplicate serial 'IPTV-TEST-STB3' to another order ID=${otherOrder.id}...`);
            const duplicatePayload = {
                sltsStatus: 'COMPLETED' as const,
                completedDate: new Date().toISOString(),
                contractorId: otherOrder.contractorId || contractorId,
                iptvSerialNumbers: ['IPTV-TEST-STB3'] // Same serial number!
            };

            try {
                await ServiceOrderService.patchServiceOrder(otherOrder.id, duplicatePayload, userId);
                console.log('❌ FAIL: Database allowed creating duplicate IPTV serial numbers.');
            } catch (err: any) {
                console.log('✅ PASS: Threw exception as expected! Error message:', err.message || err);
            }
        } else {
            console.log('Skipping Duplicate check (only 1 order in DB).');
        }

        // 5. Clean up test data
        console.log('\nCleaning up test IPTV serials...');
        await prisma.sODIptvSerial.deleteMany({
            where: {
                serialNumber: { in: ['IPTV-TEST-STB1', 'IPTV-TEST-STB2', 'IPTV-TEST-STB3'] }
            }
        });
        console.log('Clean up done.');

    } catch (err) {
        console.error('Error during testing:', err);
        // clean up
        await prisma.sODIptvSerial.deleteMany({
            where: {
                serialNumber: { in: ['IPTV-TEST-STB1', 'IPTV-TEST-STB2', 'IPTV-TEST-STB3'] }
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
