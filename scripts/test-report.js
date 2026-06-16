const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { startOfDay, endOfDay } = require('date-fns');

async function testReport() {
    const selectedDate = new Date('2026-01-24');
    const startDate = startOfDay(selectedDate);
    const endDate = endOfDay(selectedDate);

    console.log('Testing for:', selectedDate.toISOString());
    console.log('Start:', startDate.toISOString());
    console.log('End:', endDate.toISOString());

    const opmc = await prisma.oPMC.findFirst({
        where: { rtom: 'R-HK' },
        include: {
            serviceOrders: {
                where: {
                    OR: [
                        { createdAt: { gte: startDate, lte: endDate } },
                        { completedDate: { gte: startDate, lte: endDate } },
                        { statusDate: { gte: startDate, lte: endDate } },
                        { receivedDate: { gte: startDate, lte: endDate } }
                    ]
                }
            }
        }
    });

    if (!opmc) {
        console.log('OPMC not found');
        return;
    }

    console.log(`Fetched ${opmc.serviceOrders.length} potential orders for R-HK`);

    const completed = { total: 0, create: 0, data: 0 };
    opmc.serviceOrders.forEach(order => {
        const isCompletedDateToday = order.completedDate && order.completedDate >= startDate && order.completedDate <= endDate;
        if (isCompletedDateToday) {
            completed.total++;
            const type = (order.orderType || '').toUpperCase();
            if (type.includes('CREATE')) completed.create++;
            else completed.data++;
        }
    });

    console.log('Calculated Completions:', completed);
}

testReport().catch(console.error).finally(() => prisma.$disconnect());
