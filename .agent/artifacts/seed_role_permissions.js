const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const DEFAULT_ROLE_PERMISSIONS = {
  SUPER_ADMIN: ['dashboard', 'service-orders', 'contractors', 'restore-requests', 'invoices', 'inventory', 'procurement', 'administration'],
  ADMIN: ['dashboard', 'service-orders', 'contractors', 'restore-requests', 'invoices', 'inventory', 'procurement', 'administration'],
  OSP_MANAGER: ['dashboard', 'service-orders', 'contractors'],
  AREA_MANAGER: ['dashboard', 'service-orders', 'contractors'],
  ENGINEER: ['dashboard', 'service-orders', 'contractors'],
  ASSISTANT_ENGINEER: ['dashboard', 'service-orders', 'contractors'],
  AREA_COORDINATOR: ['dashboard', 'service-orders', 'contractors'],
  QC_OFFICER: ['dashboard', 'service-orders', 'contractors'],
  MANAGER: ['dashboard', 'service-orders', 'contractors'],
  STORES_MANAGER: ['dashboard', 'inventory'],
  STORES_ASSISTANT: ['dashboard', 'inventory'],
  PROCUREMENT_OFFICER: ['dashboard', 'procurement'],
  FINANCE_MANAGER: ['dashboard', 'invoices'],
  FINANCE_ASSISTANT: ['dashboard', 'invoices'],
  INVOICE_MANAGER: ['dashboard', 'invoices'],
  INVOICE_ASSISTANT: ['dashboard', 'invoices'],
  SA_MANAGER: ['dashboard', 'restore-requests'],
  SA_ASSISTANT: ['dashboard', 'restore-requests'],
  OFFICE_ADMIN: ['dashboard', 'contractors', 'administration'],
  OFFICE_ADMIN_ASSISTANT: ['dashboard', 'contractors', 'administration'],
  SITE_OFFICE_STAFF: ['dashboard', 'contractors']
};

async function main() {
  console.log('🌱 Seeding RolePermissions into Supabase PostgreSQL...');

  const systemRoles = await prisma.systemRole.findMany({ select: { id: true, code: true } });
  const roleMap = new Map(systemRoles.map(r => [r.code, r.id]));

  let totalPermissionsSeeded = 0;

  for (const [roleCode, perms] of Object.entries(DEFAULT_ROLE_PERMISSIONS)) {
    const roleId = roleMap.get(roleCode);
    if (roleId) {
      for (const perm of perms) {
        await prisma.rolePermission.upsert({
          where: { roleId_permission: { roleId, permission: perm } },
          update: {},
          create: { roleId, permission: perm }
        });
        totalPermissionsSeeded++;
      }
    }
  }

  console.log(`✅ ${totalPermissionsSeeded} RolePermission mapping records seeded live in Supabase PostgreSQL!`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
