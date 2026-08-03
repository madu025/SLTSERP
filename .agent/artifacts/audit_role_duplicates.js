const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('🔍 Auditing Roles & SystemRoles for Glitches or Duplicates in Supabase PostgreSQL...\n');

  // 1. Check SystemRole records & duplicate codes
  const systemRoles = await prisma.systemRole.findMany({
    select: { id: true, code: true, name: true, level: true, approvalLimit: true }
  });

  const codeCounts = {};
  systemRoles.forEach(r => {
    codeCounts[r.code] = (codeCounts[r.code] || 0) + 1;
  });

  const duplicateCodes = Object.entries(codeCounts).filter(([code, count]) => count > 1);

  console.log(`📊 Total SystemRole Master Records: ${systemRoles.length}`);
  if (duplicateCodes.length > 0) {
    console.log('❌ DUPLICATE SYSTEM ROLE CODES FOUND:', duplicateCodes);
  } else {
    console.log('✅ ZERO Duplicate System Role Codes. All role codes are unique!');
  }

  // 2. Check User records for Orphaned roleId or Inconsistent role codes
  const users = await prisma.user.findMany({
    select: {
      id: true,
      username: true,
      role: true,
      roleId: true,
      systemRole: { select: { id: true, code: true } }
    }
  });

  let unlinkedUsers = 0;
  let mismatchedUsers = 0;

  users.forEach(u => {
    if (!u.roleId || !u.systemRole) {
      unlinkedUsers++;
    } else if (u.role !== u.systemRole.code) {
      mismatchedUsers++;
    }
  });

  console.log(`\n📊 Total User Records Checked: ${users.length}`);
  console.log(`  - Unlinked roleId Users: ${unlinkedUsers}`);
  console.log(`  - Mismatched Role Code Users: ${mismatchedUsers}`);

  if (unlinkedUsers === 0 && mismatchedUsers === 0 && duplicateCodes.length === 0) {
    console.log('\n🎉 ALL ROLE DATA IS 100% CLEAN WITH ZERO GLITCHES OR DUPLICATES!');
  }

  console.log('\n📋 Detailed SystemRole Master List:');
  console.table(systemRoles);
}

main().catch(console.error).finally(() => prisma.$disconnect());
