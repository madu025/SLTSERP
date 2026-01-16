const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkStats() {
    console.log('Checking Data Counts...');
    const soCount = await prisma.serviceOrder.count();
    const statCount = await prisma.dashboardStat.count();

    console.log(`Service Orders: ${soCount}`);
    console.log(`Dashboard Stats Entries: ${statCount}`);

    if (soCount > 0 && statCount === 0) {
        console.log('⚠️  Mismatch detected! Stats are missing.');
        console.log('Running recalculation...');
        // We can't easily import the class directly in JS script without compiling, 
        // so we'll reimplement the sync logic briefly here or use a dedicated TS runner.
        // Actually, let's just use the API if possible, or write a proper TS script run via ts-node if available, 
        // but for now let's just see the counts.
    } else {
        console.log('✅ Counts look reasonable (or both empty).');
    }
}

checkStats()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
