import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Clearing contractor related data...');

    try {
        // Order matters due to foreign key constraints (cascading deletes help but explicit is safer)

        // 1. Clear Team Members
        const teamMembers = await prisma.teamMember.deleteMany({});
        console.log(`Deleted ${teamMembers.count} team members.`);

        // 2. Clear Team Store Assignments
        const storeAssignments = await prisma.teamStoreAssignment.deleteMany({});
        console.log(`Deleted ${storeAssignments.count} team store assignments.`);

        // 3. Clear Contractor Teams
        const teams = await prisma.contractorTeam.deleteMany({});
        console.log(`Deleted ${teams.count} contractor teams.`);

        // 4. Clear Contractor Stocks
        const stocks = await prisma.contractorStock.deleteMany({});
        console.log(`Deleted ${stocks.count} contractor stocks.`);

        // 5. Clear Contractors
        const contractors = await prisma.contractor.deleteMany({});
        console.log(`Deleted ${contractors.count} contractors.`);

        console.log('Database cleared for testing.');
    } catch (error) {
        console.error('Error during cleanup:', error);
    }
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
