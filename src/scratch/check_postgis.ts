import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  try {
    const res = await prisma.$queryRawUnsafe('SELECT PostGIS_Version()');
    console.log('PostGIS Version:', res);
  } catch (err) {
    console.log('PostGIS is not enabled or failed:', err);
  }
}

main().finally(() => prisma.$disconnect());
