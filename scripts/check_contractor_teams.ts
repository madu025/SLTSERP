import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkContractorTeams() {
    console.log('🔍 === CHECKING CONTRACTOR TEAMS & TEAM MEMBERS FOR M.N.M. SAMARANAYAKE & ALL CONTRACTORS ===\n');

    // 1. Find Contractor M.N.M. Samaranayake
    const samaranayake = await prisma.contractor.findFirst({
        where: {
            OR: [
                { name: { contains: 'Samaranayake', mode: 'insensitive' } },
                { registrationNumber: { contains: '033', mode: 'insensitive' } }
            ]
        },
        include: {
            teams: { include: { members: true } },
            teamMembers: true,
        }
    });

    if (samaranayake) {
        console.log(`📌 Contractor M.N.M. Samaranayake Details:`);
        console.log(`   - ID: ${samaranayake.id}`);
        console.log(`   - Name: ${samaranayake.name}`);
        console.log(`   - Reg: ${samaranayake.registrationNumber}`);
        console.log(`   - Teams Count: ${samaranayake.teams.length}`);
        console.log(`   - Direct Team Members Count: ${samaranayake.teamMembers.length}`);

        samaranayake.teams.forEach((t, i) => {
            console.log(`     Team ${i+1}: ${t.name} (Members: ${t.members.length})`);
        });

        samaranayake.teamMembers.forEach((m, i) => {
            console.log(`     Member ${i+1}: ${m.name} | NIC: ${m.nic || 'N/A'} | TeamId: ${m.teamId || 'UNASSIGNED TO TEAM'}`);
        });
    } else {
        console.log('❌ Contractor M.N.M. Samaranayake not found!');
    }

    console.log('\n------------------------------------------------');

    // 2. Check how many contractors have teamMembers without teamId or teams without members
    const allContractors = await prisma.contractor.findMany({
        include: {
            teams: { include: { members: true } },
            teamMembers: true,
        }
    });

    let contractorsWithUnassignedMembers = 0;
    let contractorsWithNoTeams = 0;

    for (const c of allContractors) {
        if (c.teams.length === 0) contractorsWithNoTeams++;
        const unassignedMembers = c.teamMembers.filter(m => !m.teamId);
        if (unassignedMembers.length > 0) contractorsWithUnassignedMembers++;
    }

    console.log(`📊 Summary Across All ${allContractors.length} Contractors:`);
    console.log(`   - Contractors with 0 Teams: ${contractorsWithNoTeams}`);
    console.log(`   - Contractors with Unassigned Team Members (teamId is null): ${contractorsWithUnassignedMembers}`);
}

checkContractorTeams()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
