import { PrismaClient, AccountType } from '@prisma/client';
import { CHART_OF_ACCOUNTS } from '../src/services/finance/account-codes';

const prisma = new PrismaClient();

// Derived from the single source of truth in src/services/finance/account-codes.ts
// so the seed, the ledger gateway validation, and reports can never drift apart.
export const DEFAULT_COA_ENTRIES = CHART_OF_ACCOUNTS.map((entry) => ({
    code: entry.code,
    name: entry.name,
    type: AccountType[entry.type],
    isPostable: entry.isPostable
}));

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
