const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const defaultRoles = [
  { code: 'SUPER_ADMIN', name: 'Super Administrator', description: 'Full System Control and Global Configuration', level: 100, approvalLimit: 100000000.00 },
  { code: 'ADMIN', name: 'System Administrator', description: 'Administrative Access & User Management', level: 90, approvalLimit: 50000000.00 },
  { code: 'FINANCE_MANAGER', name: 'Finance Manager', description: 'Financial Ledger & Invoicing Approvals', level: 80, approvalLimit: 10000000.00 },
  { code: 'OSP_MANAGER', name: 'OSP Operations Manager', description: 'OSP Project Management & Service Order Authorization', level: 80, approvalLimit: 5000000.00 },
  { code: 'AREA_MANAGER', name: 'Area OPMC Manager', description: 'Regional OPMC Operations & Material Release Authorization', level: 70, approvalLimit: 2000000.00 },
  { code: 'STORES_MANAGER', name: 'Inventory & Stores Manager', description: 'Warehouse, MIN/MRN Issue & Inventory Audit Control', level: 60, approvalLimit: 1000000.00 },
  { code: 'AREA_COORDINATOR', name: 'Area Coordinator', description: 'Field Coordination & PAT Status Review', level: 50, approvalLimit: 500000.00 },
  { code: 'QC_OFFICER', name: 'Quality Control Officer', description: 'PAT Inspection & Workmanship Verification', level: 50, approvalLimit: 200000.00 },
  { code: 'CONTRACTOR_SUPERVISOR', name: 'Contractor Team Supervisor', description: 'Contractor Work Allocation & Material Requisition', level: 40, approvalLimit: 100000.00 },
  { code: 'CONTRACTOR_TECHNICIAN', name: 'Contractor Technician', description: 'Field Work Execution & Mobile App Access', level: 20, approvalLimit: 0.00 },
  { code: 'ENGINEER', name: 'OSP Planning Engineer', description: 'Technical Design & Survey Processing', level: 50, approvalLimit: 500000.00 },
  { code: 'REGIONAL_GENERAL_MANAGER', name: 'Regional General Manager', description: 'Executive Regional Governance', level: 95, approvalLimit: 25000000.00 },
  { code: 'LOGISTICS_MANAGER', name: 'Logistics Manager', description: 'Fleet Management & Transport Authorization', level: 65, approvalLimit: 1500000.00 }
];

async function main() {
  console.log('🌱 Seeding 3NF SystemRoles into Supabase...');

  const roleMap = new Map();
  for (const roleDef of defaultRoles) {
    const sysRole = await prisma.systemRole.upsert({
      where: { code: roleDef.code },
      update: {
        name: roleDef.name,
        description: roleDef.description,
        level: roleDef.level,
        approvalLimit: roleDef.approvalLimit
      },
      create: {
        code: roleDef.code,
        name: roleDef.name,
        description: roleDef.description,
        level: roleDef.level,
        approvalLimit: roleDef.approvalLimit
      }
    });
    roleMap.set(roleDef.code, sysRole.id);
  }

  console.log(`✅ ${roleMap.size} SystemRoles seeded with native UUID v7 IDs.`);

  // Link all existing users to their corresponding SystemRole record via roleId
  const users = await prisma.user.findMany({ select: { id: true, role: true } });
  let linkedUsers = 0;
  for (const user of users) {
    const roleId = roleMap.get(user.role);
    if (roleId) {
      await prisma.user.update({
        where: { id: user.id },
        data: { roleId }
      });
      linkedUsers++;
    }
  }

  console.log(`✅ ${linkedUsers} User records linked to 3NF SystemRole foreign keys (roleId).`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
