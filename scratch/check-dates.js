const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const samples = await prisma.serviceOrder.findMany({
        take: 5,
        select: {
            soNum: true,
            rtom: true,
            receivedDate: true,
            statusDate: true,
            createdAt: true,
            sltsStatus: true
        }
    });
    console.log('Sample service orders:', samples);

    const minMaxDates = await prisma.serviceOrder.aggregate({
        _min: {
            receivedDate: true,
            statusDate: true,
            createdAt: true
        },
        _max: {
            receivedDate: true,
            statusDate: true,
            createdAt: true
        }
    });
    console.log('Min/Max dates in DB:', minMaxDates);
}

main().catch(console.error).finally(() => prisma.$disconnect());
