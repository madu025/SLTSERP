import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function removeFieldTeamFallbacks() {
    console.log('🧹 === REMOVING FALLBACK "Field Team" TEAMS FROM DATABASE ===\n');

    // 1. Find all teams ending with "Field Team"
    const fieldTeams = await prisma.contractorTeam.findMany({
        where: {
            name: { contains: 'Field Team', mode: 'insensitive' }
        },
        include: { members: true }
    });

    console.log(`Found ${fieldTeams.length} "Field Team" fallback teams to remove.\n`);

    for (const team of fieldTeams) {
        console.log(`🗑️ Deleting team "${team.name}" (ID: ${team.id}) for Contractor ${team.contractorId}...`);

        // Find alternative team for contractor if members exist
        const alternativeTeam = await prisma.contractorTeam.findFirst({
            where: {
                contractorId: team.contractorId,
                id: { not: team.id }
            }
        });

        // Reassign or unassign members
        if (team.members.length > 0) {
            if (alternativeTeam) {
                await prisma.teamMember.updateMany({
                    where: { teamId: team.id },
                    data: { teamId: alternativeTeam.id }
                });
                console.log(`   -> Reassigned ${team.members.length} members to alternative team "${alternativeTeam.name}"`);
            } else {
                await prisma.teamMember.updateMany({
                    where: { teamId: team.id },
                    data: { teamId: null }
                });
                console.log(`   -> Unassigned ${team.members.length} members`);
            }
        }

        // Delete store assignments and team
        await prisma.teamStoreAssignment.deleteMany({ where: { teamId: team.id } });
        await prisma.contractorTeam.delete({ where: { id: team.id } });
    }

    console.log(`\n🎉 === REMOVAL COMPLETE: ALL "Field Team" TEAMS REMOVED === 🎉\n`);
}

removeFieldTeamFallbacks()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
