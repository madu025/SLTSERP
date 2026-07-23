import { PrismaClient, AccountType } from '@prisma/client';

const prisma = new PrismaClient();

export const DEFAULT_COA_ENTRIES = [
    // ASSETS (1000 Series)
    { code: 'BANK-1000', name: 'Main Bank Account', type: AccountType.ASSET, isPostable: true },
    { code: 'INV-1010', name: 'Raw Material Inventory', type: AccountType.ASSET, isPostable: true },
    { code: 'PETTY-1020', name: 'Petty Cash Imprest Account', type: AccountType.ASSET, isPostable: true },
    { code: 'AR-1110', name: 'Accounts Receivable - Client', type: AccountType.ASSET, isPostable: true },
    { code: 'WHT-REC-1300', name: 'Withholding Tax (WHT) Receivable', type: AccountType.ASSET, isPostable: true },
    { code: 'FA-1500', name: 'Fixed Assets - Machinery & Equipment', type: AccountType.ASSET, isPostable: true },
    { code: 'ACCUM-DEP-1590', name: 'Accumulated Depreciation - Fixed Assets', type: AccountType.ASSET, isPostable: true },

    // LIABILITIES (2000 Series)
    { code: 'AP-2010', name: 'Accrued Accounts Payable', type: AccountType.LIABILITY, isPostable: true },
    { code: 'AP-VEND-2010', name: 'Trade Accounts Payable - Vendors', type: AccountType.LIABILITY, isPostable: true },
    { code: 'AP-CON-2020', name: 'Accrued Contractor Payable', type: AccountType.LIABILITY, isPostable: true },
    { code: 'VAT-PAY-2110', name: 'Output VAT Payable', type: AccountType.LIABILITY, isPostable: true },
    { code: 'SSCL-PAY-2115', name: 'SSCL Payable', type: AccountType.LIABILITY, isPostable: true },
    { code: 'WHT-PAY-2120', name: 'Withholding Tax (WHT) Payable', type: AccountType.LIABILITY, isPostable: true },
    { code: 'RET-PAY-2130', name: 'Contractor Retention Payable', type: AccountType.LIABILITY, isPostable: true },
    { code: 'HO-CLEARING-2500', name: 'Head Office Inter-Company Clearing Account', type: AccountType.LIABILITY, isPostable: true },
    { code: 'CLR-HO-9010', name: 'Head Office Clearing Account (Legacy)', type: AccountType.LIABILITY, isPostable: true },

    // EQUITY (3000 Series)
    { code: 'EQUITY-3000', name: 'Retained Earnings', type: AccountType.EQUITY, isPostable: true },

    // REVENUE (4000 Series)
    { code: 'REV-4010', name: 'Accrued Project & Service Revenue', type: AccountType.REVENUE, isPostable: true },
    { code: 'LD-INC-4200', name: 'Liquidated Damages & Penalties Income', type: AccountType.REVENUE, isPostable: true },

    // EXPENSES & COGS (5000 / 6000 / 8000 Series)
    { code: 'COGS-5010', name: 'Cost of Goods Sold - Materials Installed', type: AccountType.EXPENSE, isPostable: true },
    { code: 'SUB-5020', name: 'Subcontractor & SOD Labor Cost', type: AccountType.EXPENSE, isPostable: true },
    { code: 'EXP-CON-4020', name: 'Contractor Work Cost', type: AccountType.EXPENSE, isPostable: true },
    { code: 'EXP-WASTAGE-5030', name: 'Material Wastage & Scrap Expense', type: AccountType.EXPENSE, isPostable: true },
    { code: 'EXP-STAFF-6010', name: 'Allocated Payroll & Staff Expenses', type: AccountType.EXPENSE, isPostable: true },
    { code: 'EXP-VEHICLE-6020', name: 'Vehicle Running & Maintenance Cost', type: AccountType.EXPENSE, isPostable: true },
    { code: 'EXP-DEP-6030', name: 'Depreciation Expense', type: AccountType.EXPENSE, isPostable: true },
    { code: 'EXP-PETTY-6040', name: 'General & Administrative Petty Cash Expenses', type: AccountType.EXPENSE, isPostable: true },
    { code: 'EXP-OSP-8010', name: 'OSP Direct Expense (Legacy)', type: AccountType.EXPENSE, isPostable: true }
];

export async function seedChartOfAccounts() {
    console.log('Seeding Chart of Accounts master entries...');
    for (const item of DEFAULT_COA_ENTRIES) {
        await prisma.chartOfAccount.upsert({
            where: { code: item.code },
            update: {
                name: item.name,
                type: item.type,
                isPostable: item.isPostable,
                isActive: true
            },
            create: {
                code: item.code,
                name: item.name,
                type: item.type,
                isPostable: item.isPostable,
                isActive: true
            }
        });
    }
    console.log(`Successfully seeded ${DEFAULT_COA_ENTRIES.length} CoA entries.`);
}

if (require.main === module) {
    seedChartOfAccounts()
        .catch((e) => {
            console.error(e);
            process.exit(1);
        })
        .finally(async () => {
            await prisma.$disconnect();
        });
}
