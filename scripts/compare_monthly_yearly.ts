import { PrismaClient } from '@prisma/client';
import { startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns';

const prisma = new PrismaClient();

async function main() {
    const now = new Date('2026-01-23');
    const firstDayOfMonth = startOfMonth(now);
    const lastDayOfMonth = endOfMonth(now);
    const firstDayOfYear = startOfYear(now);
    const lastDayOfYear = endOfYear(now);

    const monthlyReceived = await prisma.serviceOrder.count({
        where: { receivedDate: { gte: firstDayOfMonth, lte: lastDayOfMonth } }
    });

    const yearlyReceived = await prisma.serviceOrder.count({
        where: { receivedDate: { gte: firstDayOfYear, lte: lastDayOfYear } }
    });

    console.log('--- RECEIVED CHECK ---');
    console.log('Monthly Received (Jan 2026):', monthlyReceived);
    console.log('Yearly Received (2026):', yearlyReceived);

    const monthlyCompleted = await prisma.serviceOrder.count({
        where: { status: 'INSTALL_CLOSED', statusDate: { gte: firstDayOfMonth, lte: lastDayOfMonth } }
    });

    const yearlyCompleted = await prisma.serviceOrder.count({
        where: { status: 'INSTALL_CLOSED', statusDate: { gte: firstDayOfYear, lte: lastDayOfYear } }
    });

    console.log('\n--- COMPLETED CHECK ---');
    console.log('Monthly Completed (Jan 2026):', monthlyCompleted);
    console.log('Yearly Completed (2026):', yearlyCompleted);

    const inProgressOld = await prisma.serviceOrder.count({
        where: { sltsStatus: 'INPROGRESS', receivedDate: { lt: firstDayOfYear } }
    });
    console.log('\nPending work from 2025 (Imported but not in 2026 stats):', inProgressOld);
}

main().catch(console.error).finally(() => prisma.$disconnect());
