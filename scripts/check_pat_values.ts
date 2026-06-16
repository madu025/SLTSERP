import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('--- PAT STATUS BREAKDOWN ---');
    const patBreakdown = await prisma.serviceOrder.groupBy({
        by: ['patStatus'],
        _count: { _all: true }
    });
    console.log('patStatus:', patBreakdown);

    console.log('\n--- SLTS PAT STATUS BREAKDOWN ---');
    const sltsPatBreakdown = await prisma.serviceOrder.groupBy({
        by: ['sltsPatStatus'],
        _count: { _all: true }
    });
    console.log('sltsPatStatus:', sltsPatBreakdown);
}

main().catch(console.error).finally(() => prisma.$disconnect());
