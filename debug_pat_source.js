const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function debugSource() {
    const stats = await prisma.sLTPATStatus.groupBy({
        by: ['source', 'status'],
        _count: { _all: true }
    });
    console.log('SLTPATStatus distribution:', JSON.stringify(stats, null, 2));

    // Check for HO_APPROVED for a sample RTOM
    const hoApprovedSample = await prisma.sLTPATStatus.findFirst({
        where: { source: 'HO_APPROVED' }
    });
    console.log('Sample HO_APPROVED:', hoApprovedSample);

    await prisma.$disconnect();
}
debugSource();
