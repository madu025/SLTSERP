const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.warn('⚠️ WARNING: Starting QA Environment Database Reset...');
    
    // Safely delete all transactional test data
    await prisma.$transaction([
        prisma.systemErrorLog.deleteMany(),
        prisma.invoiceLineItem.deleteMany(),
        prisma.invoice.deleteMany(),
        prisma.inventoryLedger.deleteMany(),
    ]);

    console.log('✅ QA Transactional Data Reset Successfully!');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
