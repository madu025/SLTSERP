import { prisma } from '../src/lib/prisma';

async function main() {
  try {
    console.log("Dropping old table constraints and tables...");
    await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS "asset_sync_log" CASCADE;`);
    await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS "assets" CASCADE;`);
    await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS "employees" CASCADE;`);
    console.log("Successfully dropped temporary tables.");
  } catch (error) {
    console.error("Error dropping tables:", error);
  }
}

main().catch(console.error);
