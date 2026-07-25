import { prisma } from '../src/lib/prisma';

async function fixOfflineStatusRecords() {
    console.log('Fixing SOD records with sltsStatus === "OFFLINE"...');

    try {
        const res = await prisma.serviceOrder.updateMany({
            where: {
                OR: [
                    { sltsStatus: 'OFFLINE' },
                    { status: 'OFFLINE' }
                ]
            },
            data: {
                sltsStatus: 'INPROGRESS',
                isOfflineWorkOrder: true
            }
        });

        console.log(`Updated ${res.count} ServiceOrder records from sltsStatus='OFFLINE' to sltsStatus='INPROGRESS' with isOfflineWorkOrder=true.`);
    } catch (error) {
        console.error('Error updating offline status records:', error);
    } finally {
        await prisma.$disconnect();
    }
}

fixOfflineStatusRecords();
