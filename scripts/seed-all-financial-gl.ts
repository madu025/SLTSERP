import { PrismaClient } from '@prisma/client';
import { ACCOUNTS } from '../src/services/finance/account-codes';
import { seedChartOfAccounts } from '../prisma/seed-coa';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding canonical Chart of Accounts and GL mappings...');

  // 1. Ensure the canonical Chart of Accounts (single source of truth in
  //    src/services/finance/account-codes.ts) exists. GLMappingConfig rows have
  //    foreign keys to ChartOfAccount.code, so every mapped code must be present
  //    before any mapping is created. This replaces the previous parallel numeric
  //    Chart of Accounts, which caused the ledger/reports to fragment.
  await seedChartOfAccounts();

  // 2. GL mappings for the subledger events still routed through OSPLedgerService.
  //    Every code below references the canonical Chart of Accounts above.
  //
  //    Retention release, LD penalties, vehicle expenses and invoice VAT/SSCL now
  //    post through explicit LedgerService / AccountingPostingRegistry helpers and
  //    therefore no longer require generic mapping rows here. OSPLedgerService now
  //    fails loudly on a missing/inactive mapping, so only the mappings actually
  //    used by a caller are seeded.
  const mappings = [
    // OSP Petty Cash IOUs & Project Advances -> DR Advances / CR Bank
    { sourceModule: 'OSP_IOU', transactionType: 'ISSUE_ADVANCE', debitAccountCode: ACCOUNTS.ADVANCES, creditAccountCode: ACCOUNTS.BANK },
    { sourceModule: 'OSP_ADVANCE', transactionType: 'ISSUE_ADVANCE', debitAccountCode: ACCOUNTS.ADVANCES, creditAccountCode: ACCOUNTS.BANK },

    // OPMC Property / Office Rent -> DR Rent Expense / CR Bank
    { sourceModule: 'OSP_RENT', transactionType: 'PAY_RENT', debitAccountCode: ACCOUNTS.RENT_EXPENSE, creditAccountCode: ACCOUNTS.BANK },
  ];

  for (const m of mappings) {
    await prisma.gLMappingConfig.upsert({
      where: {
        sourceModule_transactionType: {
          sourceModule: m.sourceModule,
          transactionType: m.transactionType,
        },
      },
      update: {
        debitAccountCode: m.debitAccountCode,
        creditAccountCode: m.creditAccountCode,
        isActive: true,
      },
      create: {
        sourceModule: m.sourceModule,
        transactionType: m.transactionType,
        debitAccountCode: m.debitAccountCode,
        creditAccountCode: m.creditAccountCode,
        isActive: true,
      },
    });
  }
  console.log(`✅ Seeded ${mappings.length} canonical GL Mapping Configs.`);
}

main()
  .catch((e) => {
    console.error('❌ Error seeding master financial GL:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
