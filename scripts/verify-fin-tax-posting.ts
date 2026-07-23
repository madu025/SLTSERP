import { PrismaClient } from '@prisma/client';
import { TaxService } from '../src/services/finance/tax.service';

const prisma = new PrismaClient();

async function verifyTaxPostings() {
    console.log('--- Starting Finance Verification: Task 2.2 (Tax GL Postings) ---');

    await prisma.$transaction(async (tx) => {
        const testInvoiceId = `INV_TAX_${Date.now()}`;
        const netAmount = 100000;
        const vatAmount = 18000;  // 18% VAT
        const ssclAmount = 2500;   // 2.5% SSCL

        const entry = await TaxService.logInvoiceTaxPosting(tx, {
            invoiceId: testInvoiceId,
            invoiceNumber: `INV-2026-${Date.now().toString().slice(-4)}`,
            netAmount,
            vatAmount,
            ssclAmount
        });

        if (!entry) {
            throw new Error('FAILED: Tax posting returned null entry');
        }

        const lines = entry.lines;
        console.log(`Posted ${lines.length} tax journal lines:`);
        for (const l of lines) {
            console.log(`  ${l.accountCode} (${l.accountName}): DR ${l.debit} | CR ${l.credit}`);
        }

        // Verify AR total equals Net + VAT + SSCL
        const arLine = lines.find(l => l.accountCode === 'AR-1110');
        if (!arLine || Number(arLine.debit) !== 120500) {
            throw new Error(`FAILED: Client AR debit (${arLine?.debit}) !== 120,500`);
        }

        // Verify VAT liability equals 18,000
        const vatLine = lines.find(l => l.accountCode === 'VAT-PAY-2110');
        if (!vatLine || Number(vatLine.credit) !== 18000) {
            throw new Error(`FAILED: Output VAT credit (${vatLine?.credit}) !== 18,000`);
        }

        // Verify SSCL liability equals 2,500
        const ssclLine = lines.find(l => l.accountCode === 'SSCL-PAY-2115');
        if (!ssclLine || Number(ssclLine.credit) !== 2500) {
            throw new Error(`FAILED: SSCL credit (${ssclLine?.credit}) !== 2,500`);
        }
    });

    console.log('✅ Task 2.2 Verification Passed: Invoice tax postings correctly balanced and recorded.');
}

verifyTaxPostings()
    .catch((err) => {
        console.error('❌ Task 2.2 Verification Failed:', err);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
