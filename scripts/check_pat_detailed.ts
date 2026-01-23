import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('--- HO PAT STATUS BREAKDOWN ---');
    const hoPatBreakdown = await prisma.serviceOrder.groupBy({
        by: ['hoPatStatus'],
        _count: { _all: true }
    });
    console.log('hoPatStatus:', hoPatBreakdown);

    console.log('\n--- OPMC PAT STATUS BREAKDOWN ---');
    const opmcPatBreakdown = await prisma.serviceOrder.groupBy({
        by: ['opmcPatStatus'],
        _count: { _all: true }
    });
    console.log('opmcPatStatus:', opmcPatBreakdown);
}

main().catch(console.error).finally(() => prisma.$disconnect());
