// Database Cleanup Script - Remove All Contractors for Testing
// Run with: npx tsx scripts/cleanup-contractors.ts

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function cleanupContractors() {
    console.log('🔄 Starting contractor cleanup...');

    try {
        // Delete in correct order to handle foreign key constraints

        console.log('1️⃣ Deleting team member store assignments...');
        const storeAssignments = await prisma.teamStoreAssignment.deleteMany({});
        console.log(`   ✓ Deleted ${storeAssignments.count} store assignments`);

        console.log('2️⃣ Deleting team members...');
        const members = await prisma.teamMember.deleteMany({});
        console.log(`   ✓ Deleted ${members.count} team members`);

        console.log('3️⃣ Deleting contractor teams...');
        const teams = await prisma.contractorTeam.deleteMany({});
        console.log(`   ✓ Deleted ${teams.count} teams`);

        console.log('4️⃣ Deleting contractors...');
        const contractors = await prisma.contractor.deleteMany({});
        console.log(`   ✓ Deleted ${contractors.count} contractors`);

        console.log('\n✅ Cleanup completed successfully!');
        console.log('\n📊 Summary:');
        console.log(`   - Contractors: ${contractors.count}`);
        console.log(`   - Teams: ${teams.count}`);
        console.log(`   - Members: ${members.count}`);
        console.log(`   - Store Assignments: ${storeAssignments.count}`);

    } catch (error) {
        console.error('❌ Error during cleanup:', error);
        throw error;
    } finally {
        await prisma.$disconnect();
    }
}

cleanupContractors()
    .then(() => {
        console.log('\n✅ Database is now clean - ready for testing!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('❌ Cleanup failed:', error);
        process.exit(1);
    });
