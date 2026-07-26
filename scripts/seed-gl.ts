import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding Chart of Accounts...');
  
  // Create Main Accounts
  const accIOUReceivables = await prisma.chartOfAccounts.upsert({
    where: { accountCode: '1001' },
    update: {},
    create: { accountCode: '1001', accountName: 'IOU Receivables (OSP)', type: 'ASSET' }
  });

  const accCashInHand = await prisma.chartOfAccounts.upsert({
    where: { accountCode: '1002' },
    update: {},
    create: { accountCode: '1002', accountName: 'Cash in Hand (Petty Cash)', type: 'ASSET' }
  });

  const accRentExpense = await prisma.chartOfAccounts.upsert({
    where: { accountCode: '3001' },
    update: {},
    create: { accountCode: '3001', accountName: 'Property Rent Expense', type: 'EXPENSE' }
  });

  const accRentPayable = await prisma.chartOfAccounts.upsert({
    where: { accountCode: '2001' },
    update: {},
    create: { accountCode: '2001', accountName: 'Rent Payable / Bank', type: 'LIABILITY' }
  });

  console.log('Seeding GL Mappings...');
  
  // Mapping for OSP_IOU
  await prisma.gLMappingConfig.upsert({
    where: {
      sourceModule_transactionType: {
        sourceModule: 'OSP_IOU',
        transactionType: 'ISSUE_ADVANCE'
      }
    },
    update: {
      debitAccountId: accIOUReceivables.id,
      creditAccountId: accCashInHand.id,
    },
    create: {
      sourceModule: 'OSP_IOU',
      transactionType: 'ISSUE_ADVANCE',
      debitAccountId: accIOUReceivables.id,
      creditAccountId: accCashInHand.id,
    }
  });

  // Mapping for OSP_RENT
  await prisma.gLMappingConfig.upsert({
    where: {
      sourceModule_transactionType: {
        sourceModule: 'OSP_RENT',
        transactionType: 'PAY_RENT'
      }
    },
    update: {
      debitAccountId: accRentExpense.id,
      creditAccountId: accRentPayable.id,
    },
    create: {
      sourceModule: 'OSP_RENT',
      transactionType: 'PAY_RENT',
      debitAccountId: accRentExpense.id,
      creditAccountId: accRentPayable.id,
    }
  });

  console.log('Seed completed successfully!');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
