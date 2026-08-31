// Quick invariant check: ASSIGNED + terminal sltsStatus must be rejected
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
    const soNum = 'PH202510270023697';
    const original = await prisma.serviceOrder.findUnique({ where: { soNum }, select: { sltsStatus: true, status: true } });
    console.log('Original:', original);

    // Test 1: ASSIGNED (status) + COMPLETED (sltsStatus) should be rejected
    try {
        await prisma.serviceOrder.update({
            where: { soNum },
            data: { sltsStatus: 'COMPLETED', status: 'ASSIGNED' }
        });
        console.log('TEST 1 FAIL: ASSIGNED + terminal was NOT rejected');
    } catch (e) {
        console.log('TEST 1 PASS: ASSIGNED + terminal rejected');
    }

    // Test 2: ASSIGNED (sltsStatus) + PENDING (status) — valid, non-terminal pair
    try {
        await prisma.serviceOrder.update({
            where: { soNum },
            data: { sltsStatus: 'ASSIGNED', status: 'PENDING' }
        });
        const after = await prisma.serviceOrder.findUnique({ where: { soNum }, select: { sltsStatus: true, status: true } });
        console.log('TEST 2 PASS: ASSIGNED sltsStatus + PENDING status accepted:', after);
    } catch (e) {
        console.log('TEST 2 FAIL: valid ASSIGNED + PENDING was rejected:', e.message);
    }

    // Restore original state
    await prisma.serviceOrder.update({
        where: { soNum },
        data: { sltsStatus: original.sltsStatus, status: original.status }
    });
    console.log('Restored:', original);
    await prisma.$disconnect();
})();
