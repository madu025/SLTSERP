import { PrismaClient } from '@prisma/client';
import { ArApService } from '../src/services/finance/ar-ap.service';

const prisma = new PrismaClient();

async function verifyCustomerReceipts() {
    console.log('--- Starting Finance Verification: Task 3.1 (Customer Receipts) ---');

    await prisma.$transaction(async (tx) => {
        // Fetch or create a test project
        let project = await tx.project.findFirst();
        if (!project) {
            project = await tx.project.create({
                data: {
                    projectCode: `PRJ-RCT-${Date.now()}`,
                    name: 'Test Collection Project',
                    description: 'Test project for AR receipt collections',
                    status: 'IN_PROGRESS'
                }
            });
        }

        // Create test project invoice
        const invoice = await tx.projectInvoice.create({
            data: {
                invoiceNumber: `INV-TEST-RCT-${Date.now()}`,
                projectId: project.id,
                title: 'Test Project Invoice for Collection',
                totalAmount: 150000,
                paidAmount: 0,
                balanceAmount: 150000,
                status: 'UNPAID'
            }
        });

        // Record customer receipt collection of 50,000
        const receipt = await ArApService.recordCustomerReceipt(tx, {
            invoiceId: invoice.id,
            amount: 50000,
            paymentMethod: 'BANK_TRANSFER',
            referenceNumber: 'TXN-BANK-998811',
            notes: 'Partial collection against project invoice'
        });

        if (!receipt) throw new Error('FAILED: Customer receipt returned null');

        // Verify updated invoice balances
        const updatedInvoice = await tx.projectInvoice.findUnique({ where: { id: invoice.id } });
        if (!updatedInvoice) throw new Error('FAILED: Updated invoice not found');

        console.log(`Updated Invoice Balance: LKR ${updatedInvoice.balanceAmount} (Paid: LKR ${updatedInvoice.paidAmount}, Status: ${updatedInvoice.status})`);

        if (updatedInvoice.balanceAmount !== 100000 || updatedInvoice.paidAmount !== 50000) {
            throw new Error(`FAILED: Expected balance 100,000 & paid 50,000 but got balance ${updatedInvoice.balanceAmount} & paid ${updatedInvoice.paidAmount}`);
        }

        // Verify journal lines
        const entry = await tx.journalEntry.findFirst({
            where: { referenceId: receipt.id }
        });
        if (!entry) throw new Error('FAILED: Journal entry for receipt not found');

        const lines = await tx.journalLine.findMany({ where: { entryId: entry.id } });
        console.log(`Posted ${lines.length} receipt journal lines:`);
        for (const l of lines) {
            console.log(`  ${l.accountCode}: DR ${l.debit} | CR ${l.credit}`);
        }

        const bankLine = lines.find(l => l.accountCode === 'BANK-1000');
        const arLine = lines.find(l => l.accountCode === 'AR-1110');

        if (!bankLine || Number(bankLine.debit) !== 50000) {
            throw new Error('FAILED: DR BANK-1000 !== 50,000');
        }
        if (!arLine || Number(arLine.credit) !== 50000) {
            throw new Error('FAILED: CR AR-1110 !== 50,000');
        }
    });

    console.log('✅ Task 3.1 Verification Passed: Customer receipt settled invoice balance and posted DR Bank / CR AR.');
}

verifyCustomerReceipts()
    .catch((err) => {
        console.error('❌ Task 3.1 Verification Failed:', err);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
