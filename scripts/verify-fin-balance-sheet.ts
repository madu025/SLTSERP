import { PrismaClient } from '@prisma/client';
import { LedgerReportService } from '../src/services/finance/ledger-report.service';

const prisma = new PrismaClient();

async function verifyBalanceSheetReport() {
    console.log('--- Starting Finance Verification: Task 1.4 (Balance Sheet Report) ---');

    const report = await LedgerReportService.getBalanceSheetReport();

    console.log(`Total Assets               : LKR ${report.totalAssets.toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
    console.log(`Total Liabilities          : LKR ${report.totalLiabilities.toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
    console.log(`Retained Earnings          : LKR ${report.retainedEarnings.toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
    console.log(`Total Equity               : LKR ${report.totalEquity.toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
    console.log(`Total Liabilities + Equity : LKR ${report.totalLiabilitiesAndEquity.toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
    console.log(`Is Balanced                : ${report.isBalanced}`);

    if (!report.isBalanced) {
        throw new Error(
            `FAILED: Balance Sheet is unbalanced. Assets (${report.totalAssets}) !== Liabilities + Equity (${report.totalLiabilitiesAndEquity})`
        );
    }

    console.log('✅ Task 1.4 Verification Passed: Balance Sheet Assets === Liabilities + Equity.');
}

verifyBalanceSheetReport()
    .catch((err) => {
        console.error('❌ Task 1.4 Verification Failed:', err);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
