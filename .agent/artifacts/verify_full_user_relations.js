const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('🔍 Executing Full User Model & Relation Audit against Supabase PostgreSQL...');

  const userWithRelations = await prisma.user.findFirst({
    where: { username: 'qa_admin' },
    select: {
      id: true,
      username: true,
      email: true,
      role: true,
      roleId: true,
      employeeId: true,
      supervisorId: true,
      assignedStoreId: true,
      contractorId: true,
      staffId: true,
      systemRole: {
        select: { id: true, code: true, name: true, approvalLimit: true }
      },
      contractor: {
        select: { id: true, name: true, registrationNumber: true }
      },
      staff: {
        select: { id: true, name: true, designation: true }
      },
      assignedStore: {
        select: { id: true, name: true, type: true }
      },

      supervisor: {
        select: { id: true, username: true }
      },
      subordinates: {
        select: { id: true, username: true }
      },
      accessibleOpmcs: {
        select: { id: true, rtom: true, region: true }
      }
    }
  });

  console.log('\n======================================================');
  console.log('✅ FULL USER TABLE & RELATIONSHIP VERIFICATION RESULT:');
  console.log('======================================================');
  console.log(JSON.stringify(userWithRelations, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
