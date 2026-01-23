import { PrismaClient } from '@prisma/client';
import { startOfYear, endOfYear } from 'date-fns';

const prisma = new PrismaClient();

async function main() {
    const now = new Date('2026-01-23');
    const start = startOfYear(now);
    const end = endOfYear(now);

    const totalReceived2026 = await prisma.serviceOrder.count({
        where: {
            receivedDate: { gte: start, lte: end }
        }
    });

    console.log('Total Received in 2026 (Global):', totalReceived2026);

    const byOpmc = await prisma.serviceOrder.groupBy({
        by: ['opmcId'],
        where: {
            receivedDate: { gte: start, lte: end }
        },
        _count: { _all: true }
    });

    // Get OPMC names
    const opmcs = await prisma.oPMC.findMany({
        where: { id: { in: byOpmc.map(b => b.opmcId).filter((id): id is string => id !== null) } },
        select: { id: true, name: true }
    });

    console.log('\n--- BY OPMC ---');
    byOpmc.forEach(b => {
        const name = opmcs.find(o => o.id === b.opmcId)?.name || 'Unknown';
        console.log(`${name}: ${b._count._all}`);
    });
}

main().catch(console.error).finally(() => prisma.$disconnect());
