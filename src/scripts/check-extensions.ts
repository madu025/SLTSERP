import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log("Checking database extensions...");
  try {
    const extensions = await prisma.$queryRaw<any[]>`
      SELECT extname, extversion FROM pg_extension;
    `;
    console.log("Installed Postgres Extensions:", JSON.stringify(extensions, null, 2));

    // Check if postgis is installed
    const hasPostgis = extensions.some(ext => ext.extname === 'postgis');
    console.log(`PostGIS available: ${hasPostgis}`);
  } catch (err) {
    console.error("Error querying extensions:", err);
  }
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
