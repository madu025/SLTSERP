
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixProvClosed() {
    console.log('Searching for PROV_CLOSED orders marked as COMPLETED...');

    // Find records where internal status is PROV_CLOSED but SLTS status was forced to COMPLETED
    const records = await prisma.serviceOrder.findMany({
        where: {
            status: 'PROV_CLOSED',
            sltsStatus: 'COMPLETED'
        }
    });

    console.log(`Found ${records.length} records to fix.`);

    let validCount = 0;
    for (const record of records) {
        await prisma.serviceOrder.update({
            where: { id: record.id },
            data: {
                sltsStatus: 'PROV_CLOSED',
                wiredOnly: true
            }
        });
        validCount++;
    }

    console.log(`Successfully moved ${validCount} Wired Only orders to Pending View.`);
}

fixProvClosed()
    .then(async () => {
        await prisma.$disconnect();
    })
    .catch(async (e) => {
        console.error(e);
        await prisma.$disconnect();
        process.exit(1);
    });
