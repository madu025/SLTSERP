import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function syncTeamSltCodes() {
    console.log('🚀 === SYNCING CONTRACTOR TEAM sltCode = name (iSamp Team Code) ===\n');

    const teams = await prisma.contractorTeam.findMany();
    console.log(`Processing ${teams.length} ContractorTeams in database...`);

    let updatedCount = 0;

    for (const team of teams) {
        if (team.sltCode !== team.name) {
            await prisma.contractorTeam.update({
                where: { id: team.id },
                data: { sltCode: team.name }
            });
            updatedCount++;
        }
    }

    console.log(`\n🎉 === TEAM sltCode SYNC COMPLETED 100% === 🎉`);
    console.log(`   - Teams Updated (sltCode = name): ${updatedCount}\n`);

    // Verify Balapitiya's Team SLT Code
    const balapitiyaTeam = await prisma.contractorTeam.findFirst({
        where: { name: 'SLTSHO_T46' }
    });

    if (balapitiyaTeam) {
        console.log(`📌 Y D Balapitiya Team SLT Code Verification:`);
        console.log(`   - Team Name: "${balapitiyaTeam.name}"`);
        console.log(`   - SLT Code: "${balapitiyaTeam.sltCode}"`);
    }
}

syncTeamSltCodes()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
