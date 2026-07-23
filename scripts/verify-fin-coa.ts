import { PrismaClient } from '@prisma/client';
import { DEFAULT_COA_ENTRIES, seedChartOfAccounts } from '../prisma/seed-coa';

const prisma = new PrismaClient();

async function runVerification() {
    console.log('--- Starting Finance Verification: Task 0.1 (Chart of Accounts Master) ---');

    // 1. Seed CoA
    await seedChartOfAccounts();

    // 2. Fetch all CoA records
    const allAccounts = await prisma.chartOfAccount.findMany();
    console.log(`Total ChartOfAccount records in DB: ${allAccounts.length}`);

    // 3. Assert count >= default entries
    if (allAccounts.length < DEFAULT_COA_ENTRIES.length) {
        throw new Error(`CoA record count (${allAccounts.length}) is less than expected (${DEFAULT_COA_ENTRIES.length})`);
    }

    // 4. Assert uniqueness and validity of every default code
    const codeMap = new Map<string, string>();
    for (const acc of allAccounts) {
        if (codeMap.has(acc.code)) {
            throw new Error(`Duplicate ChartOfAccount code detected: ${acc.code}`);
        }
        codeMap.set(acc.code, acc.name);
    }

    for (const expected of DEFAULT_COA_ENTRIES) {
        if (!codeMap.has(expected.code)) {
            throw new Error(`Expected account code '${expected.code}' missing from ChartOfAccount table`);
        }
    }

    console.log('✅ Task 0.1 Verification Passed: Chart of Accounts master is valid, non-duplicate, and populated.');
}

runVerification()
    .catch((err) => {
        console.error('❌ Task 0.1 Verification Failed:', err);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
