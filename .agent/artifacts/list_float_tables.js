const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const floatCols = await prisma.$queryRawUnsafe(`
    SELECT table_name::text, column_name::text
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND data_type IN ('double precision', 'real')
    ORDER BY table_name, column_name
  `);

  // Group by table
  const byTable = {};
  for (const r of floatCols) {
    if (!byTable[r.table_name]) byTable[r.table_name] = [];
    byTable[r.table_name].push(r.column_name);
  }

  console.log('FLOAT COLUMNS BY TABLE:');
  for (const [t, cols] of Object.entries(byTable)) {
    console.log(`${t}: ${cols.join(', ')}`);
  }
  console.log(`\nTotal tables affected: ${Object.keys(byTable).length}`);
  console.log(`Total float columns: ${floatCols.length}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
