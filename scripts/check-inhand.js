const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { startOfDay } = require('date-fns');

async function checkInHandAndReceived() {
    const selectedDate = new Date('2026-01-24');
    const startDate = startOfDay(selectedDate);

    console.log('--- Checking Counts for 2026-01-24 ---');

    // 1. RECEIVED TODAY
    const received = await prisma.serviceOrder.groupBy({
        by: ['rtom'],
        where: {
            receivedDate: { gte: startDate, lt: new Date(startDate.getTime() + 24 * 60 * 60 * 1000) }
        },
        _count: { id: true }
    });

    console.log('\n[RECEIVED TODAY] (by receivedDate):');
    received.forEach(r => console.log(`${r.rtom}: ${r._count.id}`));

    // 2. IN HAND MORNING (The complex one)
    // Orders created BEFORE today AND (Never completed OR completed today or later)
    const inHandMorning = await prisma.serviceOrder.groupBy({
        by: ['rtom'],
        where: {
            createdAt: { lt: startDate },
            OR: [
                { completedDate: null },
                { completedDate: { gte: startDate } }
            ],
            AND: [
                {
                    OR: [
                        { sltsStatus: { not: 'RETURN' } },
                        { statusDate: { gte: startDate } }
                    ]
                }
            ]
        },
        _count: { id: true }
    });

    console.log('\n[IN HAND MORNING] (Existing before today & still pending at 00:00):');
    inHandMorning.forEach(r => console.log(`${r.rtom}: ${r._count.id}`));
}

checkInHandAndReceived().catch(console.error).finally(() => prisma.$disconnect());
