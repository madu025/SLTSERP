import { PrismaClient } from '@prisma/client';
import { DEFAULT_ROLE_PERMISSIONS, SECTION_MAPPING } from '../src/config/auth-defaults';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding SystemConfig for Auth configurations...');

  await prisma.systemConfig.upsert({
    where: { key: 'DEFAULT_ROLE_PERMISSIONS' },
    update: {
      value: JSON.stringify(DEFAULT_ROLE_PERMISSIONS),
      description: 'Default permissions array for each role.'
    },
    create: {
      key: 'DEFAULT_ROLE_PERMISSIONS',
      value: JSON.stringify(DEFAULT_ROLE_PERMISSIONS),
      description: 'Default permissions array for each role.'
    }
  });

  await prisma.systemConfig.upsert({
    where: { key: 'SECTION_MAPPING' },
    update: {
      value: JSON.stringify(SECTION_MAPPING),
      description: 'Mapping of Role to Sections'
    },
    create: {
      key: 'SECTION_MAPPING',
      value: JSON.stringify(SECTION_MAPPING),
      description: 'Mapping of Role to Sections'
    }
  });

  // QA audit: the TEST_USERS permission-bypass config was removed. No runtime
  // consumer exists, so we stop seeding it and clean up any legacy row.
  await prisma.systemConfig.delete({ where: { key: 'TEST_USERS' } }).catch(() => {
    // Row may not exist on fresh environments — safe to ignore
  });

  console.log('Auth configurations seeded successfully.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
