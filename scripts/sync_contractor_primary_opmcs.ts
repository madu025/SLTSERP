import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function syncContractorPrimaryOpmcs() {
    console.log('🚀 === SYNCING CONTRACTOR PRIMARY OPMC / RTOM REGION FIELDS ===\n');

    // Fetch all contractors with their teams
    const contractors = await prisma.contractor.findMany({
        include: {
            teams: {
                include: { opmc: true }
            }
        }
    });

    console.log(`Processing ${contractors.length} Contractors...`);

    let updatedCount = 0;

    for (const c of contractors) {
        // Find primary opmcId from contractor's teams
        const teamWithOpmc = c.teams.find(t => t.opmcId && t.opmc);
        if (teamWithOpmc && teamWithOpmc.opmcId) {
            if (c.opmcId !== teamWithOpmc.opmcId) {
                await prisma.contractor.update({
                    where: { id: c.id },
                    data: { opmcId: teamWithOpmc.opmcId }
                });
                updatedCount++;
                console.log(`✅ Contractor "${c.name}" $\\rightarrow$ Set RTOM OPMC: "${teamWithOpmc.opmc?.name}" (${teamWithOpmc.opmc?.rtom})`);
            }
        }
    }

    console.log(`\n🎉 === OPMC RTOM REGION SYNC COMPLETED 100% === 🎉`);
    console.log(`   - Contractors Updated with RTOM Region: ${updatedCount}\n`);

    // Verify Balapitiya
    const balapitiya = await prisma.contractor.findFirst({
        where: { name: { contains: 'Balapitiya', mode: 'insensitive' } },
        include: { opmc: true, teams: { include: { opmc: true } } }
    });

    if (balapitiya) {
        console.log(`📌 Y D Balapitiya RTOM Verification:`);
        console.log(`   - Name: ${balapitiya.name}`);
        console.log(`   - Linked OPMC Region: "${balapitiya.opmc?.name}" (${balapitiya.opmc?.rtom})`);
    }
}

syncContractorPrimaryOpmcs()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
