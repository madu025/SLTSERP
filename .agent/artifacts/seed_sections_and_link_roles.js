const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const defaultSections = [
  { code: 'EXEC', name: 'Executive & Administration', description: 'Executive Leadership & System Administration', icon: 'ShieldCheck', color: '#4F46E5' },
  { code: 'FINANCE', name: 'Finance & Accounting', description: 'Financial Ledgers, Invoicing & Budget Allocations', icon: 'BadgeDollarSign', color: '#059669' },
  { code: 'OSP_OPS', name: 'OSP Operations & Engineering', description: 'Outside Plant Infrastructure & Service Order Management', icon: 'Network', color: '#2563EB' },
  { code: 'STORES', name: 'Stores & Material Logistics', description: 'Warehouse Management, Stock Issues, GRN & MRN', icon: 'Warehouse', color: '#D97706' },
  { code: 'QC', name: 'Quality Control & PAT Inspection', description: 'PAT Verification & Field Audits', icon: 'ClipboardCheck', color: '#7C3AED' },
  { code: 'CONTRACTOR', name: 'Contractor Operations', description: 'Contractor Teams, Work Requisitions & Material Usage', icon: 'HardHat', color: '#DC2626' }
];

const roleSectionMap = {
  'SUPER_ADMIN': 'EXEC',
  'ADMIN': 'EXEC',
  'REGIONAL_GENERAL_MANAGER': 'EXEC',
  'FINANCE_MANAGER': 'FINANCE',
  'OSP_MANAGER': 'OSP_OPS',
  'AREA_MANAGER': 'OSP_OPS',
  'AREA_COORDINATOR': 'OSP_OPS',
  'ENGINEER': 'OSP_OPS',
  'STORES_MANAGER': 'STORES',
  'LOGISTICS_MANAGER': 'STORES',
  'QC_OFFICER': 'QC',
  'CONTRACTOR_SUPERVISOR': 'CONTRACTOR',
  'CONTRACTOR_TECHNICIAN': 'CONTRACTOR'
};

async function main() {
  console.log('🌱 Seeding Sections & Linking SystemRoles Section-Wise in Supabase...');

  // 1. Seed Sections
  const sectionMap = new Map();
  for (const sec of defaultSections) {
    const sectionObj = await prisma.section.upsert({
      where: { code: sec.code },
      update: { name: sec.name, description: sec.description, icon: sec.icon, color: sec.color },
      create: { code: sec.code, name: sec.name, description: sec.description, icon: sec.icon, color: sec.color }
    });
    sectionMap.set(sec.code, sectionObj.id);
  }

  console.log(`✅ ${sectionMap.size} Sections Seeded.`);

  // 2. Link SystemRoles to Sections via sectionId
  let linkedRoles = 0;
  for (const [roleCode, secCode] of Object.entries(roleSectionMap)) {
    const sectionId = sectionMap.get(secCode);
    if (sectionId) {
      await prisma.systemRole.updateMany({
        where: { code: roleCode },
        data: { sectionId }
      });
      linkedRoles++;
    }
  }

  console.log(`✅ ${linkedRoles} SystemRoles Linked Section-Wise.`);

  // 3. Create UserSectionAssignment records for all active users
  const users = await prisma.user.findMany({
    select: { id: true, roleId: true, systemRole: { select: { sectionId: true } } }
  });

  let createdAssignments = 0;
  for (const u of users) {
    if (u.roleId && u.systemRole?.sectionId) {
      await prisma.userSectionAssignment.deleteMany({ where: { userId: u.id } });
      await prisma.userSectionAssignment.create({
        data: {
          userId: u.id,
          roleId: u.roleId,
          sectionId: u.systemRole.sectionId,
          isPrimary: true
        }
      });
      createdAssignments++;
    }
  }

  console.log(`✅ ${createdAssignments} UserSectionAssignment records populated.`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
