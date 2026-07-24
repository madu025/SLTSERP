import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function inspectRukshanTeams() {
    console.log('🔍 === INSPECTING ALL TEAMS FOR CONTRACTOR MAS RUKSHAN ===\n');

    const contractor = await prisma.contractor.findFirst({
        where: { name: { contains: 'Rukshan', mode: 'insensitive' } },
        include: {
            opmc: true,
            teams: {
                include: {
                    opmc: true,
                    members: true,
                    storeAssignments: { include: { store: true } }
                }
            }
        }
    });

    if (!contractor) {
        console.log('❌ Contractor not found');
        return;
    }

    console.log(`📌 Contractor: "${contractor.name}" (Reg: ${contractor.registrationNumber})`);
    console.log(`📌 Total Teams: ${contractor.teams.length}\n`);

    contractor.teams.forEach((t, i) => {
        console.log(`Team #${i + 1}:`);
        console.log(`  - ID: ${t.id}`);
        console.log(`  - Name: "${t.name}"`);
        console.log(`  - SLT Code: "${t.sltCode}"`);
        console.log(`  - OPMC RTOM: "${t.opmc?.name}" (${t.opmc?.rtom})`);
        console.log(`  - Members (${t.members.length}): ${t.members.map(m => m.name).join(', ') || 'None'}`);
        console.log(`  - Stores (${t.storeAssignments.length}): ${t.storeAssignments.map(sa => sa.store.name).join(', ') || 'None'}\n`);
    });
}

inspectRukshanTeams()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
