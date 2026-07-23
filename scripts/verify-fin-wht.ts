import { PrismaClient } from '@prisma/client';
import { TaxService } from '../src/services/finance/tax.service';

const prisma = new PrismaClient();

async function verifyWhtRegisterReport() {
    console.log('--- Starting Finance Verification: Task 2.4 (WHT Register Report) ---');

    const report = await TaxService.getWhtRegister();

    console.log(`Total WHT Withheld: LKR ${report.totalWithheld.toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
    console.log(`Total Certificates: ${report.certificates.length}`);

    const sumCertificates = report.certificates.reduce((acc, c) => acc + c.whtAmount, 0);
    if (Math.abs(report.totalWithheld - sumCertificates) > 0.001) {
        throw new Error(`FAILED: Total WHT withheld (${report.totalWithheld}) !== sum of certificate amounts (${sumCertificates})`);
    }

    console.log('✅ Task 2.4 Verification Passed: WHT Register sum of certificates matches total tax withheld.');
}

verifyWhtRegisterReport()
    .catch((err) => {
        console.error('❌ Task 2.4 Verification Failed:', err);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
