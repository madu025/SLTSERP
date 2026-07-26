import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding Chart of Accounts for SOD Invoicing...');
  
  // Unbilled Receivables (Asset)
  const accUnbilledAR = await prisma.chartOfAccount.upsert({
    where: { code: '1201' },
    update: {},
    create: { code: '1201', name: 'Unbilled Receivables (WIP)', type: 'ASSET' }
  });

  // SOD Service Revenue (Revenue)
  const accSODRevenue = await prisma.chartOfAccount.upsert({
    where: { code: '4001' },
    update: {},
    create: { code: '4001', name: 'SOD Service Revenue', type: 'REVENUE' }
  });

  console.log('Seeding GL Mappings for SOD Invoicing...');
  
  await prisma.gLMappingConfig.upsert({
    where: {
      sourceModule_transactionType: {
        sourceModule: 'SOD_INVOICING',
        transactionType: 'RECOGNIZE_REVENUE'
      }
    },
    update: {
      debitAccountCode: accUnbilledAR.code,
      creditAccountCode: accSODRevenue.code,
    },
    create: {
      sourceModule: 'SOD_INVOICING',
      transactionType: 'RECOGNIZE_REVENUE',
      debitAccountCode: accUnbilledAR.code,
      creditAccountCode: accSODRevenue.code,
    }
  });

  console.log('SOD GL Seed completed successfully!');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
