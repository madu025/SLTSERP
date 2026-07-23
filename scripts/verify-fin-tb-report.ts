import { PrismaClient } from '@prisma/client';
import { LedgerReportService } from '../src/services/finance/ledger-report.service';

const prisma = new PrismaClient();

async function verifyTrialBalanceReport() {
    console.log('--- Starting Finance Verification: Task 1.2 (Trial Balance Report) ---');

    const report = await LedgerReportService.getAccountBalances();

    console.log(`Trial Balance Account Count: ${report.accounts.length}`);
    console.log(`Total Debit : LKR ${report.totalDebit.toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
    console.log(`Total Credit: LKR ${report.totalCredit.toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
    console.log(`Is Balanced : ${report.isBalanced}`);

    if (!report.isBalanced) {
        throw new Error(`FAILED: Trial Balance report is unbalanced by LKR ${report.difference}`);
    }

    console.log('✅ Task 1.2 Verification Passed: Trial Balance total DR === CR.');
}

verifyTrialBalanceReport()
    .catch((err) => {
        console.error('❌ Task 1.2 Verification Failed:', err);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
