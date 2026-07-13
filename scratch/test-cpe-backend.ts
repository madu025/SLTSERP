import { prisma } from '../src/lib/prisma';
import { ServiceOrderService } from '../src/services/sod';

async function runTest() {
    console.log('--- Starting CPE Backend Recovery Test ---');

    // 1. Get an existing service order to test with
    const testOrder = await prisma.serviceOrder.findFirst({
        orderBy: { createdAt: 'desc' }
    });

    if (!testOrder) {
        console.error('No service order found in database to test with!');
        return;
    }

    console.log(`Found test Service Order: ID=${testOrder.id}, SO_NUM=${testOrder.soNum}, sltsStatus=${testOrder.sltsStatus}`);

    // Ensure there is a contractor assigned
    let contractorId = testOrder.contractorId;
    if (!contractorId) {
        const contractor = await prisma.contractor.findFirst();
        if (!contractor) {
            console.error('No contractor found to associate with test order.');
            return;
        }
        contractorId = contractor.id;
        // Update order with contractorId
        await prisma.serviceOrder.update({
            where: { id: testOrder.id },
            data: { contractorId }
        });
        console.log(`Assigned Contractor ID=${contractorId} to test order.`);
    }

    // Ensure there is a valid user to avoid foreign key violations in audit log
    const user = await prisma.user.findFirst();
    if (!user) {
        console.error('No user found in database to associate audit log with.');
        return;
    }
    const userId = user.id;

    // 2. Perform mock completion/patch with collected CPEs
    console.log('Patching service order to complete with collected CPE items...');
    const patchPayload = {
        sltsStatus: 'COMPLETED' as const,
        completedDate: new Date().toISOString(),
        contractorId,
        collectedCpes: [
            {
                deviceType: 'ONT',
                serialNumber: 'TEST-ONT-SERIAL-12345',
                condition: 'FAULTY'
            },
            {
                deviceType: 'STB',
                serialNumber: 'TEST-STB-SERIAL-67890',
                condition: 'WORKING'
            }
        ]
    };

    try {
        const updated = await ServiceOrderService.patchServiceOrder(testOrder.id, patchPayload, userId);
        console.log('Successfully patched service order!');

        // 3. Verify in database that CollectedCPE records were created
        const collectedItems = await prisma.collectedCPE.findMany({
            where: { serviceOrderId: testOrder.id }
        });

        console.log(`CPE Records found in database: ${collectedItems.length}`);
        collectedItems.forEach((c, idx) => {
            console.log(` [${idx + 1}] Device: ${c.deviceType}, Serial: ${c.serialNumber}, Condition: ${c.condition}, Status: ${c.status}`);
        });

        if (collectedItems.length === 2) {
            console.log('✅ PASS: Exactly 2 collected CPE records created successfully!');
        } else {
            console.log('❌ FAIL: Incorrect number of collected CPE records created.');
        }

        // 4. Test CPE Handback Flow (Bulk mark as HANDED_BACK)
        const idsToHandback = collectedItems.map(c => c.id);
        const handbackRef = 'SLT-RECEIPT-REF-99999';

        console.log(`Testing handback handover for IDs: ${JSON.stringify(idsToHandback)} with Ref: ${handbackRef}`);
        const updateResult = await prisma.collectedCPE.updateMany({
            where: {
                id: { in: idsToHandback },
                status: 'PENDING_HANDBACK'
            },
            data: {
                status: 'HANDED_BACK',
                handbackDate: new Date(),
                handbackReference: handbackRef
            }
        });

        console.log(`Prisma transaction updated count: ${updateResult.count}`);

        // Verify status is HANDED_BACK
        const updatedCpes = await prisma.collectedCPE.findMany({
            where: { id: { in: idsToHandback } }
        });

        const allHandedBack = updatedCpes.every(c => c.status === 'HANDED_BACK' && c.handbackReference === handbackRef);
        if (allHandedBack) {
            console.log('✅ PASS: All items marked as HANDED_BACK with correct reference!');
        } else {
            console.log('❌ FAIL: Handback transition did not update correctly.');
        }

        // 5. Clean up test data
        console.log('Cleaning up test data...');
        await prisma.collectedCPE.deleteMany({
            where: { serviceOrderId: testOrder.id }
        });
        console.log('Clean up done.');

    } catch (error) {
        console.error('Error during test execution:', error);
    }
}

runTest()
    .then(() => prisma.$disconnect())
    .catch((err) => {
        console.error(err);
        prisma.$disconnect();
    });
