import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function checkCompletions() {
    const today = new Date('2026-01-24');
    const start = new Date(today.setHours(0, 0, 0, 0));
    const end = new Date(today.setHours(23, 59, 59, 999));

    const completions = await prisma.serviceOrder.groupBy({
        by: ['rtom'],
        where: {
            sltsStatus: 'COMPLETED',
            completedDate: {
                gte: start,
                lte: end
            }
        },
        _count: {
            id: true
        }
    });

    console.log('--- Database Completions (Total Count) ---');
    console.log(JSON.stringify(completions, null, 2));

    const historyCompletions = await prisma.serviceOrderStatusHistory.groupBy({
        by: ['serviceOrderId'],
        where: {
            status: { in: ['INSTALL_CLOSED', 'COMPLETED'] },
            statusDate: {
                gte: start,
                lte: end
            }
        }
    });

    // Resolve RTOMs for these history entries
    const historyIds = historyCompletions.map(h => h.serviceOrderId);
    const historyOrders = await prisma.serviceOrder.findMany({
        where: { id: { in: historyIds } },
        select: { rtom: true }
    });

    const historyRtomCount: Record<string, number> = {};
    historyOrders.forEach(o => {
        historyRtomCount[o.rtom] = (historyRtomCount[o.rtom] || 0) + 1;
    });

    console.log('\n--- History Status Completions (Status changed today) ---');
    console.log(JSON.stringify(historyRtomCount, null, 2));
}

checkCompletions()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
