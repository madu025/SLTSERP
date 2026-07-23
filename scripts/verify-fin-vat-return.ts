import { PrismaClient } from '@prisma/client';
import { TaxService } from '../src/services/finance/tax.service';

const prisma = new PrismaClient();

async function verifyVatReturnReport() {
    console.log('--- Starting Finance Verification: Task 2.3 (VAT Return Report) ---');

    const report = await TaxService.getVatReturn();

    console.log(`Output VAT Total: LKR ${report.outputVatTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
    console.log(`Input VAT Total : LKR ${report.inputVatTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
    console.log(`Net VAT Payable : LKR ${report.netVatPayable.toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
    console.log(`Total VAT Lines : ${report.lineItems.length}`);

    const expectedNet = report.outputVatTotal - report.inputVatTotal;
    if (Math.abs(report.netVatPayable - expectedNet) > 0.001) {
        throw new Error(`FAILED: Net VAT Payable (${report.netVatPayable}) !== Output VAT - Input VAT (${expectedNet})`);
    }

    console.log('✅ Task 2.3 Verification Passed: VAT Return math (Net Payable = Output VAT - Input VAT) is valid.');
}

verifyVatReturnReport()
    .catch((err) => {
        console.error('❌ Task 2.3 Verification Failed:', err);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
