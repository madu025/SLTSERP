const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function debugDashboard() {
    console.log('--- DASHBOARD DEBUG ---');

    // 1. Check Super Admin User
    const user = await prisma.user.findFirst({
        where: { role: 'SUPER_ADMIN' }
    });
    console.log('Super Admin found:', user ? `Yes (${user.id})` : 'No');

    // 2. Check Service Orders for 2026
    const soCount = await prisma.serviceOrder.count({
        where: { createdAt: { gte: new Date('2026-01-01') } }
    });
    console.log('Total Service Orders (2026):', soCount);

    // 3. Check DashboardStat table entries
    const stats = await prisma.dashboardStat.findMany();
    const totalPending = stats.reduce((acc, s) => acc + s.pending, 0);
    console.log('Entries in DashboardStat:', stats.length);
    console.log('Sum of Pending in DashboardStat:', totalPending);

    // 4. Sample OPMC check
    const sampleOpmc = await prisma.oPMC.findFirst();
    if (sampleOpmc) {
        const opmcStats = await prisma.dashboardStat.findUnique({
            where: { opmcId: sampleOpmc.id }
        });
        console.log(`Sample RTOM (${sampleOpmc.rtom}) Stats:`, opmcStats);
    }
}

debugDashboard()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
