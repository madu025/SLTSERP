import { PrismaClient, FiscalPeriodStatus } from '@prisma/client';
import { LedgerService } from '../src/services/finance/ledger.service';
import { FiscalPeriodService } from '../src/services/finance/fiscal-period.service';

const prisma = new PrismaClient();

async function runPeriodLockVerification() {
    console.log('--- Starting Finance Verification: Task 0.3 (Fiscal Period & Lock) ---');

    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;

    // 1. Ensure period is OPEN
    await FiscalPeriodService.setPeriodStatus(year, month, FiscalPeriodStatus.OPEN);

    // 2. Post into OPEN period (expect success)
    let openEntryId: string | null = null;
    await prisma.$transaction(async (tx) => {
        const entry = await LedgerService.postTransaction(tx, {
            referenceId: `PER_OPEN_${Date.now()}`,
            referenceType: 'TEST',
            description: 'Post into OPEN period',
            lines: [
                { accountCode: 'INV-1010', debit: 200, credit: 0 },
                { accountCode: 'AP-2010', debit: 0, credit: 200 }
            ]
        });
        openEntryId = entry.id;
    });
    console.log(`  ✓ Successfully posted transaction ${openEntryId} in OPEN period ${year}-${month}`);

    // 3. Lock/Close period
    await FiscalPeriodService.setPeriodStatus(year, month, FiscalPeriodStatus.LOCKED);

    // 4. Attempt post into LOCKED period (expect rejection)
    let caughtLockedError = false;
    try {
        await prisma.$transaction(async (tx) => {
            await LedgerService.postTransaction(tx, {
                referenceId: `PER_LOCKED_${Date.now()}`,
                referenceType: 'TEST',
                description: 'Post into LOCKED period',
                lines: [
                    { accountCode: 'INV-1010', debit: 200, credit: 0 },
                    { accountCode: 'AP-2010', debit: 0, credit: 200 }
                ]
            });
        });
    } catch (e: any) {
        caughtLockedError = true;
        console.log(`  ✓ Successfully rejected posting in LOCKED period: ${e.message}`);
    }

    // Restore period to OPEN for dev workflow
    await FiscalPeriodService.setPeriodStatus(year, month, FiscalPeriodStatus.OPEN);

    if (!caughtLockedError) {
        throw new Error('FAILED: Posting into LOCKED period was allowed');
    }

    console.log('✅ Task 0.3 Verification Passed: Period lock enforcement is fully operational.');
}

runPeriodLockVerification()
    .catch((err) => {
        console.error('❌ Task 0.3 Verification Failed:', err);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
