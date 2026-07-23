import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function assertTrialBalanceIntegrity() {
    console.log('--- Executing Trial Balance Integrity Harness (Task 0.4) ---');

    const result = await prisma.journalLine.aggregate({
        _sum: {
            debit: true,
            credit: true
        }
    });

    const totalDebit = Number(result._sum.debit || 0);
    const totalCredit = Number(result._sum.credit || 0);
    const difference = Math.abs(totalDebit - totalCredit);

    console.log(`Global GL Totals:`);
    console.log(`  Total Debit : LKR ${totalDebit.toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
    console.log(`  Total Credit: LKR ${totalCredit.toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
    console.log(`  Difference  : LKR ${difference.toFixed(4)}`);

    if (difference > 0.01) {
        throw new Error(
            `TRIAL BALANCE UNBALANCED: Total Debit (${totalDebit}) does not match Total Credit (${totalCredit}). Imbalance: ${difference}`
        );
    }

    console.log('✅ Trial Balance Integrity Assertion PASSED: System-wide Double Entry DR === CR.');
    return { totalDebit, totalCredit, difference };
}

if (require.main === module) {
    assertTrialBalanceIntegrity()
        .catch((err) => {
            console.error('❌ Trial Balance Integrity Verification Failed:', err);
            process.exit(1);
        })
        .finally(async () => {
            await prisma.$disconnect();
        });
}
