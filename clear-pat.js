const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('Clearing PAT statuses...');
    const result = await prisma.serviceOrder.updateMany({
        data: {
            sltsPatStatus: 'PENDING',
            opmcPatStatus: 'PENDING',
            hoPatStatus: 'PENDING',
            sltsPatDate: null,
            opmcPatDate: null,
            hoPatDate: null,
            isInvoicable: false
        }
    });
    console.log(`Cleared ${result.count} records.`);
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
