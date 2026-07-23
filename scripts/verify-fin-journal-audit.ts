import { PrismaClient } from '@prisma/client';
import { LedgerService } from '../src/services/finance/ledger.service';

const prisma = new PrismaClient();

async function runJournalAuditVerification() {
    console.log('--- Starting Finance Verification: Task 0.2 (Journal Audit Hardening & Immutability) ---');

    await prisma.$transaction(async (tx) => {
        const testRefId = `TEST_AUDIT_${Date.now()}`;

        // 1. Attempt unbalanced posting (expect error)
        let caughtUnbalancedError = false;
        try {
            await LedgerService.postTransaction(tx, {
                referenceId: testRefId,
                referenceType: 'TEST',
                description: 'Unbalanced Test Entry',
                lines: [
                    { accountCode: 'INV-1010', debit: 500, credit: 0 },
                    { accountCode: 'AP-2010', debit: 0, credit: 400 } // Unbalanced!
                ]
            });
        } catch (e: any) {
            caughtUnbalancedError = true;
            console.log(`  ✓ Successfully rejected unbalanced entry: ${e.message}`);
        }
        if (!caughtUnbalancedError) {
            throw new Error('FAILED: Unbalanced transaction was incorrectly allowed');
        }

        // 2. Post valid double-entry transaction
        const entry = await LedgerService.postTransaction(tx, {
            referenceId: testRefId,
            referenceType: 'TEST',
            description: 'Valid Double-Entry Audit Test',
            createdById: 'VERIFY_BOT',
            lines: [
                { accountCode: 'INV-1010', debit: 1500, credit: 0 },
                { accountCode: 'AP-2010', debit: 0, credit: 1500 }
            ]
        });

        if (entry.status !== 'POSTED' || !entry.isLocked) {
            throw new Error(`FAILED: Entry status (${entry.status}) or isLocked (${entry.isLocked}) incorrect`);
        }
        console.log(`  ✓ Created locked journal entry ${entry.id} with status POSTED`);

        // 3. Test transaction reversal
        const reversal = await LedgerService.reverseTransaction(
            tx,
            entry.id,
            'Audit verification reversal',
            'VERIFY_BOT'
        );

        if (reversal.lines.length !== 2) {
            throw new Error(`FAILED: Reversal line count (${reversal.lines.length}) !== 2`);
        }

        // Check updated status of original entry
        const updatedOriginal = await tx.journalEntry.findUnique({ where: { id: entry.id } });
        if (updatedOriginal?.status !== 'REVERSED') {
            throw new Error(`FAILED: Original entry status was not updated to REVERSED`);
        }
        console.log(`  ✓ Successfully created reversal entry ${reversal.id} and marked original as REVERSED`);

        // 4. Attempt double reversal (expect error)
        let caughtDoubleReversalError = false;
        try {
            await LedgerService.reverseTransaction(tx, entry.id, 'Second Reversal Attempt');
        } catch (e: any) {
            caughtDoubleReversalError = true;
            console.log(`  ✓ Successfully rejected double reversal attempt: ${e.message}`);
        }
        if (!caughtDoubleReversalError) {
            throw new Error('FAILED: Double reversal was incorrectly allowed');
        }
    });

    console.log('✅ Task 0.2 Verification Passed: Centralized posting gateway, immutability, and reversals are fully operational.');
}

runJournalAuditVerification()
    .catch((err) => {
        console.error('❌ Task 0.2 Verification Failed:', err);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
