import { PrismaClient } from '@prisma/client';
import { LedgerReportService } from '../src/services/finance/ledger-report.service';

const prisma = new PrismaClient();

async function verifyPnlReport() {
    console.log('--- Starting Finance Verification: Task 1.3 (Profit & Loss Report) ---');

    const report = await LedgerReportService.getPnlReport();

    console.log(`Total Revenue : LKR ${report.totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
    console.log(`Total Expense : LKR ${report.totalExpense.toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
    console.log(`Net Profit    : LKR ${report.netProfit.toLocaleString('en-US', { minimumFractionDigits: 2 })}`);

    const expectedNetProfit = report.totalRevenue - report.totalExpense;
    if (Math.abs(report.netProfit - expectedNetProfit) > 0.001) {
        throw new Error(`FAILED: P&L Net Profit (${report.netProfit}) does not match Total Revenue - Total Expense (${expectedNetProfit})`);
    }

    console.log('✅ Task 1.3 Verification Passed: P&L math (Net Profit = Revenue - Expenses) is valid.');
}

verifyPnlReport()
    .catch((err) => {
        console.error('❌ Task 1.3 Verification Failed:', err);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
