import { PrismaClient } from '@prisma/client';
import { ArApService } from '../src/services/finance/ar-ap.service';

const prisma = new PrismaClient();

async function verifyArAgingReport() {
    console.log('--- Starting Finance Verification: Task 3.2 (AR Aging Report) ---');

    const report = await ArApService.getArAgingReport();

    console.log(`AR Aging Summary:`);
    console.log(`  Current (0-30 days) : LKR ${report.summary.current.toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
    console.log(`  31 - 60 days        : LKR ${report.summary.days31to60.toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
    console.log(`  61 - 90 days        : LKR ${report.summary.days61to90.toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
    console.log(`  Over 90 days        : LKR ${report.summary.over90.toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
    console.log(`  Total AR Sub-ledger : LKR ${report.summary.total.toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
    console.log(`  GL Control (AR-1110): LKR ${report.glControlBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}`);

    const sumBuckets = report.summary.current + report.summary.days31to60 + report.summary.days61to90 + report.summary.over90;
    if (Math.abs(report.summary.total - sumBuckets) > 0.001) {
        throw new Error(`FAILED: Total AR sum (${report.summary.total}) !== sum of aging buckets (${sumBuckets})`);
    }

    console.log('✅ Task 3.2 Verification Passed: AR Aging buckets sum correctly to total AR sub-ledger.');
}

verifyArAgingReport()
    .catch((err) => {
        console.error('❌ Task 3.2 Verification Failed:', err);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
