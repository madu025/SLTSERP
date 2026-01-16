const { PrismaClient } = require('@prisma/client');

// Force use of READ_REPLICA_URL
// Note: Prisma usually picks one based on datasource config, but we can try to override env var
process.env.DATABASE_URL = process.env.READ_REPLICA_URL;

const prisma = new PrismaClient();

async function checkReplica() {
    console.log('Checking REPLICA Data...');
    try {
        const soCount = await prisma.serviceOrder.count();
        const statCount = await prisma.dashboardStat.count();

        console.log(`[REPLICA] Service Orders: ${soCount}`);
        console.log(`[REPLICA] Dashboard Stats: ${statCount}`);

        const totalPending = await prisma.dashboardStat.aggregate({
            _sum: { pending: true }
        });
        console.log(`[REPLICA] Total Pending: ${totalPending._sum.pending}`);

    } catch (e) {
        console.error("Error connecting to Replica:", e);
    }
}

checkReplica()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
