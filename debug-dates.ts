
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function analyzeNulls() {
    try {
        // Count how many NULL completedDate items have been touched today
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const nulls = await prisma.serviceOrder.findMany({
            where: {
                sltsStatus: 'COMPLETED',
                completedDate: null
            },
            take: 5,
            select: {
                id: true,
                createdAt: true,
                updatedAt: true,
                sltsStatus: true,
                status: true,
                completedDate: true
            }
        });

        console.log('--- SAMPLE NULL RECORDS ---');
        console.table(nulls);

        const countToday = await prisma.serviceOrder.count({
            where: {
                sltsStatus: 'COMPLETED',
                completedDate: null,
                updatedAt: { gte: today }
            }
        });

        console.log(`Total NULL completedDate records updated TODAY: ${countToday}`);

    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

analyzeNulls();
