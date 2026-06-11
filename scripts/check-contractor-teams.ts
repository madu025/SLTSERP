import { prisma } from '../src/lib/prisma';

async function main() {
    console.log('Checking registered testing contractors, teams, and members...\n');

    const contractors = await prisma.contractor.findMany({
        where: { name: { startsWith: 'Testing Contractor -' } },
        include: {
            teams: {
                include: {
                    members: true,
                    storeAssignments: true
                }
            }
        }
    });

    console.log(`Found ${contractors.length} testing contractors in database.\n`);

    if (contractors.length > 0) {
        console.log('Sample Data:');
        contractors.slice(0, 5).forEach(con => {
            console.log(`Contractor: ${con.name} (Reg No: ${con.registrationNumber})`);
            console.log(`Teams Count: ${con.teams.length}`);
            con.teams.forEach(team => {
                console.log(`  - Team Name: ${team.name} (SLT Code: ${team.sltCode})`);
                console.log(`    Members Count: ${team.members.length}`);
                team.members.forEach(member => {
                    console.log(`      * Member Name: ${member.name} (Designation: ${member.designation})`);
                });
                console.log(`    Store Assignments: ${team.storeAssignments.length}`);
                team.storeAssignments.forEach(sa => {
                    console.log(`      * Store ID: ${sa.storeId} (Primary: ${sa.isPrimary})`);
                });
            });
            console.log('─'.repeat(50));
        });
    }
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
