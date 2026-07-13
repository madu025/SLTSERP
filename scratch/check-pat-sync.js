const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const totalPatStatus = await prisma.sLTPATStatus.count();
    console.log('Total SLTPATStatus records in DB:', totalPatStatus);

    const groupedPat = await prisma.sLTPATStatus.groupBy({
        by: ['status'],
        _count: { id: true }
    });
    console.log('Grouped by status in SLTPATStatus:', groupedPat);

    const samplePat = await prisma.sLTPATStatus.findMany({
        take: 5
    });
    console.log('Sample SLTPATStatus records:', samplePat);

    // Let's check status counts in ServiceOrder table
    const serviceOrderPatCounts = await prisma.serviceOrder.groupBy({
        by: ['sltsPatStatus', 'hoPatStatus', 'opmcPatStatus'],
        _count: { id: true }
    });
    console.log('ServiceOrder PAT status groups:', serviceOrderPatCounts);
}

main().catch(console.error).finally(() => prisma.$disconnect());
