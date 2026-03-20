const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const sods = await prisma.serviceOrder.findMany({
        orderBy: { updatedAt: 'desc' },
        take: 5,
        include: {
            _count: {
                select: { commentsHistory: true }
            }
        }
    });

    console.log(JSON.stringify(sods.map(s => ({
        soNum: s.soNum,
        comments: s.comments,
        _count: s._count,
        updatedAt: s.updatedAt
    })), null, 2));
}

main().finally(() => prisma.$disconnect());
