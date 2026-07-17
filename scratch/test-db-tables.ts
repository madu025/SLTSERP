import { prisma } from '../src/lib/prisma';

async function main() {
  try {
    const tables = await prisma.$queryRawUnsafe<{ table_name: string }[]>(
      `SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name;`
    );
    const names = tables.map(t => t.table_name);
    console.log("All tables:", names);
    
    console.log("Tables containing 'emp':", names.filter(n => n.toLowerCase().includes('emp')));
    console.log("Tables containing 'asset':", names.filter(n => n.toLowerCase().includes('asset')));
  } catch (error) {
    console.error("Error fetching tables:", error);
  }
}

main().catch(console.error);
