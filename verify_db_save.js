const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function verify() {
    console.log('--- Database Verification ---');

    // 1. Check SLTPATStatus (The global cache)
    const patCount = await prisma.sLTPATStatus.count();
    const latestPat = await prisma.sLTPATStatus.findMany({
        take: 3,
        orderBy: { updatedAt: 'desc' },
        select: { soNum: true, status: true, source: true, updatedAt: true }
    });

    console.log(`\nTotal records in SLTPATStatus (Cache): ${patCount}`);
    if (latestPat.length > 0) {
        console.log('Latest Cache updates:');
        console.table(latestPat);
    }

    // 2. Check ServiceOrder (Actual linked orders)
    const linkedApproved = await prisma.serviceOrder.count({
        where: { hoPatStatus: 'PAT_PASSED' }
    });
    const linkedRejected = await prisma.serviceOrder.count({
        where: { OR: [{ hoPatStatus: 'REJECTED' }, { opmcPatStatus: 'REJECTED' }] }
    });

    console.log(`\nSODs Updated with PAT PASSED: ${linkedApproved}`);
    console.log(`SODs Updated with REJECTED: ${linkedRejected}`);

    await prisma.$disconnect();
}

verify();
