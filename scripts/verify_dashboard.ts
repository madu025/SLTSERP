import { PrismaClient } from '@prisma/client';
import { startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns';

const prisma = new PrismaClient();

async function main() {
    const now = new Date('2026-01-23'); // Simulate current time
    const firstDayOfMonth = startOfMonth(now);
    const lastDayOfMonth = endOfMonth(now);
    const firstDayOfYear = startOfYear(now);
    const lastDayOfYear = endOfYear(now);

    console.log('--- DATE RANGES ---');
    console.log('Month:', firstDayOfMonth.toISOString(), 'to', lastDayOfMonth.toISOString());
    console.log('Year:', firstDayOfYear.toISOString(), 'to', lastDayOfYear.toISOString());

    const stats = {
        monthlyReceived: await prisma.serviceOrder.count({
            where: { receivedDate: { gte: firstDayOfMonth, lte: lastDayOfMonth } }
        }),
        monthlyCompleted: await prisma.serviceOrder.count({
            where: { sltsStatus: 'COMPLETED', statusDate: { gte: firstDayOfMonth, lte: lastDayOfMonth } }
        }),
        yearlyReceived: await prisma.serviceOrder.count({
            where: { receivedDate: { gte: firstDayOfYear, lte: lastDayOfYear } }
        }),
        yearlyCompleted: await prisma.serviceOrder.count({
            where: { sltsStatus: 'COMPLETED', statusDate: { gte: firstDayOfYear, lte: lastDayOfYear } }
        }),
        historicalInDB: await prisma.serviceOrder.count({
            where: { OR: [{ receivedDate: { lt: firstDayOfYear } }, { statusDate: { lt: firstDayOfYear } }] }
        })
    };

    console.log('\n--- CALCULATED STATS ---');
    console.log(JSON.stringify(stats, null, 2));
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
