import { PrismaClient } from '@prisma/client';
import { LedgerReportService } from '../src/services/finance/ledger-report.service';

const prisma = new PrismaClient();

async function verifyCashFlowReport() {
    console.log('--- Starting Finance Verification: Task 1.5 (Cash Flow Statement Report) ---');

    const report = await LedgerReportService.getCashFlowReport();

    console.log(`Opening Cash : LKR ${report.openingCash.toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
    console.log(`Total Inflow : LKR ${report.totalInflow.toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
    console.log(`Total Outflow: LKR ${report.totalOutflow.toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
    console.log(`Net Movement : LKR ${report.netCashFlow.toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
    console.log(`Closing Cash : LKR ${report.closingCash.toLocaleString('en-US', { minimumFractionDigits: 2 })}`);

    const expectedClosing = report.openingCash + report.netCashFlow;
    if (Math.abs(report.closingCash - expectedClosing) > 0.001) {
        throw new Error(`FAILED: Cash flow closing cash (${report.closingCash}) !== opening + net movement (${expectedClosing})`);
    }

    console.log('✅ Task 1.5 Verification Passed: Cash Flow math (Closing = Opening + Net Movement) is valid.');
}

verifyCashFlowReport()
    .catch((err) => {
        console.error('❌ Task 1.5 Verification Failed:', err);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
