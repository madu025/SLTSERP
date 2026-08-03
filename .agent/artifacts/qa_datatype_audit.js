const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('=== QA DATABASE DATA TYPE AUDIT - LIVE SUPABASE ===\n');

  // Use prisma.$queryRawUnsafe to run the information_schema SQL
  const badIds = await prisma.$queryRawUnsafe(`
    SELECT table_name::text, column_name::text, data_type::text
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND column_name = 'id'
      AND data_type <> 'uuid'
    ORDER BY table_name
  `);

  const badFKs = await prisma.$queryRawUnsafe(`
    SELECT table_name::text, column_name::text, data_type::text
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND column_name LIKE '%\_id'
      AND column_name <> 'employee_id'
      AND data_type <> 'uuid'
    ORDER BY table_name, column_name
  `);

  const floatCols = await prisma.$queryRawUnsafe(`
    SELECT table_name::text, column_name::text, data_type::text
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND data_type IN ('double precision', 'real')
    ORDER BY table_name, column_name
  `);

  const statusTextCols = await prisma.$queryRawUnsafe(`
    SELECT table_name::text, column_name::text, data_type::text, udt_name::text
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND column_name IN ('status','role','type','category','priority')
      AND data_type IN ('text','character varying')
    ORDER BY table_name, column_name
  `);

  console.log('=== 🔑 NON-UUID PRIMARY KEYS (id columns) ===');
  if (badIds.length === 0) console.log('✅ ALL id columns are UUID - PASS');
  else badIds.forEach(r => console.log(`  ❌ ${r.table_name}.${r.column_name} = ${r.data_type}`));

  console.log('\n=== 🔗 NON-UUID FOREIGN KEY COLUMNS (*_id) ===');
  if (badFKs.length === 0) console.log('✅ ALL foreign key columns are UUID - PASS');
  else badFKs.forEach(r => console.log(`  ❌ ${r.table_name}.${r.column_name} = ${r.data_type}`));

  console.log('\n=== 💰 FLOAT/DOUBLE PRECISION COLUMNS (Should be NUMERIC) ===');
  if (floatCols.length === 0) console.log('✅ NO float columns found - PASS');
  else floatCols.forEach(r => console.log(`  ❌ ${r.table_name}.${r.column_name} = ${r.data_type}`));

  console.log('\n=== 🏷️ STATUS/ROLE TEXT COLUMNS (Should be ENUM) ===');
  if (statusTextCols.length === 0) console.log('✅ ALL status/role columns are ENUM - PASS');
  else statusTextCols.forEach(r => console.log(`  ⚠️  ${r.table_name}.${r.column_name} = ${r.data_type} (udt: ${r.udt_name})`));

  const total = badIds.length + badFKs.length + floatCols.length;
  console.log('\n=== 🏆 QA VERDICT ===');
  if (total === 0) {
    console.log('✅ DATABASE DATA TYPES: 100% QA PASS');
  } else {
    console.log(`❌ QA FAIL: ${badIds.length} bad PKs, ${badFKs.length} bad FKs, ${floatCols.length} float columns`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
