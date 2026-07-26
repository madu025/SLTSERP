import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding Master Chart of Accounts and SLA Mappings...');

  const coaList = [
    { code: '1001', name: 'Main Operating Bank Account', type: 'ASSET' },
    { code: '1002', name: 'OPMC Regional Petty Cash Float', type: 'ASSET' },
    { code: '1201', name: 'Unbilled Receivables (WIP)', type: 'ASSET' },
    { code: '1202', name: 'OSP Staff & Contractor Advances', type: 'ASSET' },
    { code: '1301', name: 'OSP Inventory Material Stock', type: 'ASSET' },
    { code: '2001', name: 'Trade Accounts Payable (Contractors)', type: 'LIABILITY' },
    { code: '2003', name: 'Withholding Tax (WHT) Payable', type: 'LIABILITY' },
    { code: '2005', name: 'Contractor Retention Payable (5%)', type: 'LIABILITY' },
    { code: '4001', name: 'SOD Service Revenue', type: 'REVENUE' },
    { code: '4005', name: 'Liquidated Damages (LD) Penalty Income', type: 'REVENUE' },
    { code: '5001', name: 'Material Cost of Goods Sold (COGS)', type: 'EXPENSE' },
    { code: '5002', name: 'OPMC Property Rent Expense', type: 'EXPENSE' },
  ];

  for (const coa of coaList) {
    await prisma.chartOfAccount.upsert({
      where: { code: coa.code },
      update: { name: coa.name, type: coa.type },
      create: coa,
    });
  }
  console.log('✅ Chart of Accounts seeded.');

  const mappings = [
    // OSP Petty Cash & Advances
    { sourceModule: 'OSP_IOU', transactionType: 'ISSUE_ADVANCE', debitAccountCode: '1202', creditAccountCode: '1001' },
    { sourceModule: 'OSP_ADVANCE', transactionType: 'ISSUE_ADVANCE', debitAccountCode: '1202', creditAccountCode: '1001' },
    { sourceModule: 'OSP_RENT', transactionType: 'PAY_RENT', debitAccountCode: '5002', creditAccountCode: '1001' },
    
    // SOD Revenue
    { sourceModule: 'SOD_INVOICING', transactionType: 'RECOGNIZE_REVENUE', debitAccountCode: '1201', creditAccountCode: '4001' },
    
    // Payment Vouchers (AP Settlement)
    { sourceModule: 'PAYMENT_VOUCHER', transactionType: 'DISBURSE_PAYMENT', debitAccountCode: '2001', creditAccountCode: '1001' },

    // Retention (Hold & Release)
    { sourceModule: 'RETENTION', transactionType: 'HOLD_RETENTION', debitAccountCode: '2001', creditAccountCode: '2005' },
    { sourceModule: 'RETENTION', transactionType: 'RELEASE_RETENTION', debitAccountCode: '2005', creditAccountCode: '1001' },

    // LD Penalties
    { sourceModule: 'LD_PENALTY', transactionType: 'APPLY_PENALTY', debitAccountCode: '2001', creditAccountCode: '4005' },

    // Material COGS
    { sourceModule: 'MATERIAL_ISSUE', transactionType: 'ALLOCATE_COGS', debitAccountCode: '5001', creditAccountCode: '1301' },

    // Petty Cash Float
    { sourceModule: 'PETTY_CASH', transactionType: 'REIMBURSE_FLOAT', debitAccountCode: '1002', creditAccountCode: '1001' },

    // Tax WHT
    { sourceModule: 'TAX', transactionType: 'DEDUCT_WHT', debitAccountCode: '2001', creditAccountCode: '2003' },
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
  console.log('✅ Master GL Mapping Configs seeded.');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding master financial GL:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
