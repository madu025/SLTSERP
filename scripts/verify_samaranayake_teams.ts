import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function verifySamaranayakeTeams() {
    console.log('🔍 === VERIFYING SAMARANAYAKE TEAMS & MEMBERS ===\n');

    const samaranayake = await prisma.contractor.findFirst({
        where: { name: { contains: 'Samaranayake', mode: 'insensitive' } },
        include: {
            teams: { include: { members: true } },
            teamMembers: { include: { team: true } }
        }
    });

    if (!samaranayake) {
        console.log('❌ Contractor M.N.M. Samaranayake not found!');
        return;
    }

    console.log(`📌 Contractor: ${samaranayake.name} (${samaranayake.registrationNumber}) [ID: ${samaranayake.id}]`);
    console.log(`   - Teams Count: ${samaranayake.teams.length}`);
    samaranayake.teams.forEach(t => {
        console.log(`     • Team ID: ${t.id} | Name: "${t.name}" | Members Count: ${t.members.length}`);
        t.members.forEach(m => console.log(`       -> Member: ${m.name} | NIC: ${m.nic} | Phone: ${m.contactNumber}`));
    });

    console.log(`\n   - Direct TeamMembers Count: ${samaranayake.teamMembers.length}`);
    samaranayake.teamMembers.forEach(m => {
        console.log(`     • Member: ${m.name} | NIC: ${m.nic} | Team: "${m.team?.name || 'UNASSIGNED'}" (TeamId: ${m.teamId})`);
    });
}

verifySamaranayakeTeams()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
