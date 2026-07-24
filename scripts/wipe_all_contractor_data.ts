import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function wipeAllContractorData() {
    console.log('🧹 === WIPING ALL CONTRACTOR RELATED DATA FROM DATABASE ===\n');

    // 1. Unlink foreign keys referencing Contractor / ContractorTeam
    console.log('🔗 Step 1: Unlinking ServiceOrder & User contractorId references...');
    await prisma.serviceOrder.updateMany({ where: { contractorId: { not: null } }, data: { contractorId: null, teamId: null } });
    await prisma.user.updateMany({ where: { contractorId: { not: null } }, data: { contractorId: null } });

    // 2. Delete child tables and dependent invoices
    console.log('🗑️ Step 2: Deleting Invoices, Penalties, TeamMembers, StoreAssignments, ContractorTeams, PerformanceScores, PaymentConfigs...');
    await prisma.invoice.deleteMany({});
    await prisma.penalty.deleteMany({});
    const deletedMembers = await prisma.teamMember.deleteMany({});
    const deletedStoreAssign = await prisma.teamStoreAssignment.deleteMany({});
    const deletedTeams = await prisma.contractorTeam.deleteMany({});
    await prisma.contractorPerformanceScore.deleteMany({});
    await prisma.contractorPaymentTier.deleteMany({});
    await prisma.contractorPaymentConfig.deleteMany({});

    // 3. Delete all Contractor records
    console.log('💥 Step 3: Deleting all Contractor records...');
    const deletedContractors = await prisma.contractor.deleteMany({});

    console.log(`\n🎉 === WIPE COMPLETE: ALL CONTRACTOR DATA HAS BEEN 100% CLEARED === 🎉`);
    console.log(`   - Cleared Contractors: ${deletedContractors.count}`);
    console.log(`   - Cleared ContractorTeams: ${deletedTeams.count}`);
    console.log(`   - Cleared TeamMembers: ${deletedMembers.count}`);
    console.log(`   - Cleared Store Assignments: ${deletedStoreAssign.count}\n`);
}

wipeAllContractorData()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
