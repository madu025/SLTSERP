const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const totalNull = await prisma.serviceOrder.count({
        where: {
            OR: [
                { receivedDate: null },
                { completedDate: null },
                { statusDate: null }
            ]
        }
    });
    console.log('Total service orders with at least one null date field:', totalNull);

    const allNull = await prisma.serviceOrder.count({
        where: {
            receivedDate: null,
            completedDate: null,
            statusDate: null
        }
    });
    console.log('Total service orders with ALL date fields null:', allNull);

    // Let's inspect some of these
    const samples = await prisma.serviceOrder.findMany({
        where: {
            receivedDate: null,
            completedDate: null,
            statusDate: null
        },
        take: 10,
        select: {
            soNum: true,
            rtom: true,
            createdAt: true
        }
    });
    console.log('Samples of all-null date orders:', samples);
}

main().catch(console.error).finally(() => prisma.$disconnect());
