import { PrismaClient, FiscalPeriodStatus } from '@prisma/client';
import { PeriodCloseService } from '../src/services/finance/period-close.service';
import { FiscalPeriodService } from '../src/services/finance/fiscal-period.service';

const prisma = new PrismaClient();

async function verifyCreditNoteAdjustment() {
    console.log('--- Starting Finance Verification: Task 7.2 (Credit / Debit Notes) ---');

    // Ensure period 2026-07 is OPEN for testing
    await FiscalPeriodService.setPeriodStatus(2026, 7, FiscalPeriodStatus.OPEN);

    await prisma.$transaction(async (tx) => {
        // Fetch or create a test project
        let project = await tx.project.findFirst();
        if (!project) {
            project = await tx.project.create({
                data: {
                    projectCode: `PRJ-CN-${Date.now()}`,
                    name: 'Test Credit Note Project',
                    description: 'Test project for credit notes',
                    status: 'IN_PROGRESS'
                }
            });
        }

        // Create test project invoice
        const invoice = await tx.projectInvoice.create({
            data: {
                invoiceNumber: `INV-TEST-CN-${Date.now()}`,
                projectId: project.id,
                title: 'Test Invoice for Credit Note Adjustment',
                totalAmount: 200000,
                paidAmount: 0,
                balanceAmount: 200000,
                status: 'UNPAID'
            }
        });

        // Issue Credit Note of 25,000 against invoice
        const note = await PeriodCloseService.createCreditDebitNote(tx, {
            type: 'CREDIT_NOTE',
            invoiceId: invoice.id,
            amount: 25000,
            reason: 'Quantity adjustment per client agreement'
        });

        if (!note) throw new Error('FAILED: Credit Note returned null');

        // Verify updated invoice balance
        const updatedInvoice = await tx.projectInvoice.findUnique({ where: { id: invoice.id } });
        console.log(`Updated Invoice Balance after Credit Note: LKR ${updatedInvoice?.balanceAmount}`);

        if (updatedInvoice?.balanceAmount !== 175000) {
            throw new Error(`FAILED: Expected balance 175,000 but got ${updatedInvoice?.balanceAmount}`);
        }

        // Verify GL journal lines: DR REV-4010 25,000 / CR AR-1110 25,000
        const lines = await tx.journalLine.findMany({ where: { entryId: note.postedJournalId! } });
        console.log(`Posted ${lines.length} Credit Note journal lines:`);
        for (const l of lines) {
            console.log(`  ${l.accountCode}: DR ${l.debit} | CR ${l.credit}`);
        }

        const revLine = lines.find(l => l.accountCode === 'REV-4010');
        const arLine = lines.find(l => l.accountCode === 'AR-1110');

        if (!revLine || Number(revLine.debit) !== 25000) {
            throw new Error('FAILED: DR REV-4010 !== 25,000');
        }
        if (!arLine || Number(arLine.credit) !== 25000) {
            throw new Error('FAILED: CR AR-1110 !== 25,000');
        }
    });

    console.log('✅ Task 7.2 Verification Passed: Credit Note adjusted invoice balance and posted DR Revenue / CR AR correctly.');
}

verifyCreditNoteAdjustment()
    .catch((err) => {
        console.error('❌ Task 7.2 Verification Failed:', err);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
