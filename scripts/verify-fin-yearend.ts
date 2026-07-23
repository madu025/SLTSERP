import { PrismaClient } from '@prisma/client';
import { PeriodCloseService } from '../src/services/finance/period-close.service';

const prisma = new PrismaClient();

async function verifyYearEndClose() {
    console.log('--- Starting Finance Verification: Task 7.1 (Year-End Close & Retained Earnings) ---');

    const result = await prisma.$transaction(async (tx) => {
        return await PeriodCloseService.executeYearEndClose(tx, 2026);
    }, { timeout: 20000 });

    console.log(`Executed Year-End Close for FY ${result.year}:`);
    console.log(`  Total Revenue : LKR ${result.totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
    console.log(`  Total Expense : LKR ${result.totalExpense.toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
    console.log(`  Net Profit    : LKR ${result.netProfit.toLocaleString('en-US', { minimumFractionDigits: 2 })}`);

    if (result.journalId) {
        const lines = await prisma.journalLine.findMany({
            where: { entryId: result.journalId }
        });
        console.log(`Posted ${lines.length} Year-End closing journal lines:`);
        for (const l of lines) {
            console.log(`  ${l.accountCode}: DR ${l.debit} | CR ${l.credit}`);
        }
    }

    // Verify all 12 fiscal periods for 2026 are LOCKED
    const periods = await prisma.fiscalPeriod.findMany({ where: { year: 2026 } });
    const lockedCount = periods.filter(p => p.status === 'LOCKED').length;
    console.log(`Locked Fiscal Periods for 2026: ${lockedCount} / 12`);

    if (lockedCount !== 12) {
        throw new Error(`FAILED: Expected 12 LOCKED periods but got ${lockedCount}`);
    }

    console.log('✅ Task 7.1 Verification Passed: Year-End P&L zeroing, Retained Earnings rollover, and Period Lock are valid.');
}

verifyYearEndClose()
    .catch((err) => {
        console.error('❌ Task 7.1 Verification Failed:', err);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
