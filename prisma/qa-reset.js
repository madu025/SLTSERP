/* eslint-disable @typescript-eslint/no-require-imports -- QA reset is a CommonJS script. */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const dbUrl = process.env.DATABASE_URL || '';
    if (!/@(localhost|127\.0\.0\.1)(:|\/)/.test(dbUrl)) {
        throw new Error('qa-reset refuses to run against a non-local DATABASE_URL');
    }
    console.warn('⚠️ WARNING: Starting QA Environment Database Reset...');

    // Safely delete all transactional test data (local DB only)
    await prisma.$transaction(async (tx) => {
        // InventoryLedger is immutable; the reset must opt in explicitly.
        await tx.$executeRawUnsafe("SET LOCAL app.allow_inventory_ledger_mutation = 'on'");
        await tx.systemErrorLog.deleteMany();
        await tx.invoiceLineItem.deleteMany();
        await tx.invoice.deleteMany();
        await tx.inventoryLedger.deleteMany();
    });

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
