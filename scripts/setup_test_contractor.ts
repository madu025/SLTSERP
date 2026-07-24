import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function setupTestContractorAccount() {
  console.log('====================================================');
  console.log('🛠️ REGISTERED CONTRACTOR TEST ACCOUNT SETUP & AUDIT');
  console.log('====================================================\n');

  // 1. Fetch active registered contractor
  const activeContractor = await prisma.contractor.findFirst({
    where: { status: 'ACTIVE' },
    select: {
      id: true,
      name: true,
      status: true,
      type: true,
      registrationNumber: true,
    }
  });

  if (!activeContractor) {
    console.log('⚠️ No active registered contractor found.');
    return;
  }

  console.log(`🎯 Selected ACTIVE Registered Contractor for Mobile Testing:`);
  console.log(`   - Name: ${activeContractor.name}`);
  console.log(`   - ID: ${activeContractor.id}`);
  console.log(`   - Status: ${activeContractor.status}`);
  console.log(`   - Registration No: ${activeContractor.registrationNumber || 'N/A'}`);

  // 2. Link contractor_demo user to this active contractor
  const testPassword = 'Pass123!';
  const hashedPassword = await bcrypt.hash(testPassword, 10);

  const contractorUser = await prisma.user.upsert({
    where: { username: 'contractor_demo' },
    update: {
      role: 'CONTRACTOR_SUPERVISOR',
      contractorId: activeContractor.id,
      password: hashedPassword,
      name: `${activeContractor.name} (Supervisor)`,
      status: 'active',
    },
    create: {
      username: 'contractor_demo',
      email: 'contractor.demo@sltserp.lk',
      password: hashedPassword,
      name: `${activeContractor.name} (Supervisor)`,
      role: 'CONTRACTOR_SUPERVISOR',
      contractorId: activeContractor.id,
      status: 'active',
    }
  });

  console.log('\n====================================================');
  console.log('📱 ACTIVE CONTRACTOR TEST LOGIN CREDENTIALS:');
  console.log('====================================================');
  console.log(`   URL:      http://localhost:3000/contractor/login`);
  console.log(`   Username: contractor_demo`);
  console.log(`   Password: Pass123!`);
  console.log(`   Role:     ${contractorUser.role}`);
  console.log(`   Linked Contractor: ${activeContractor.name} (${activeContractor.id})`);
  console.log('====================================================\n');

  await prisma.$disconnect();
}

setupTestContractorAccount().catch(console.error);
