import { PrismaClient } from '@prisma/client';
import { DEFAULT_ROLE_PERMISSIONS, SECTION_MAPPING, TEST_USERS } from '../src/config/auth-defaults';

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

  await prisma.systemConfig.upsert({
    where: { key: 'TEST_USERS' },
    update: {
      value: JSON.stringify(TEST_USERS),
      description: 'List of test users that bypass permission checks'
    },
    create: {
      key: 'TEST_USERS',
      value: JSON.stringify(TEST_USERS),
      description: 'List of test users that bypass permission checks'
    }
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
