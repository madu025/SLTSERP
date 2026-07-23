import { PrismaClient } from '@prisma/client';
import { BankCashService } from '../src/services/finance/bank-cash.service';

const prisma = new PrismaClient();

async function verifyBankReconciliation() {
    console.log('--- Starting Finance Verification: Task 4.1 & 4.2 (Bank & Cash Book) ---');

    // 1. Verify Cash Book calculation
    const cashBook = await BankCashService.getCashBook('BANK-1000');
    console.log(`Cash Book for BANK-1000 (${cashBook.accountName}):`);
    console.log(`  Opening Balance : LKR ${cashBook.openingBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
    console.log(`  Total Debit     : LKR ${cashBook.totalDebit.toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
    console.log(`  Total Credit    : LKR ${cashBook.totalCredit.toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
    console.log(`  Closing Balance : LKR ${cashBook.closingBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
    console.log(`  Total Rows      : ${cashBook.rows.length}`);

    // Verify closing balance math
    const expectedClosing = cashBook.openingBalance + cashBook.totalDebit - cashBook.totalCredit;
    if (Math.abs(cashBook.closingBalance - expectedClosing) > 0.001) {
        throw new Error(`FAILED: Cash Book closing balance (${cashBook.closingBalance}) !== opening + debit - credit (${expectedClosing})`);
    }

    // 2. Test Bank Account & Statement Line Creation
    const testAccount = await prisma.bankAccount.create({
        data: {
            accountNumber: `ACC-TEST-${Date.now()}`,
            bankName: 'Commercial Bank of Ceylon',
            branchName: 'Head Office Colombo',
            glAccountCode: 'BANK-1000',
            openingBalance: 500000,
            currentBalance: 500000
        }
    });

    await BankCashService.importBankStatement(testAccount.id, [
        {
            statementDate: new Date(),
            description: 'Direct Deposit Client Receipt',
            debit: 100000,
            credit: 0
        },
        {
            statementDate: new Date(),
            description: 'Vendor Service Payment',
            debit: 0,
            credit: 25000
        }
    ]);

    const summary = await BankCashService.getBankReconciliationSummary(testAccount.id);
    console.log(`Bank Statement Reconciliation Summary:`);
    console.log(`  Bank Account     : ${summary.bankName} (${summary.accountNumber})`);
    console.log(`  Statement Balance: LKR ${summary.statementBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
    console.log(`  GL Bank Balance  : LKR ${summary.reconciledGlBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
    console.log(`  Variance         : LKR ${summary.variance.toLocaleString('en-US', { minimumFractionDigits: 2 })}`);

    if (summary.statementBalance !== 575000) {
        throw new Error(`FAILED: Expected statement balance 575,000 but got ${summary.statementBalance}`);
    }

    console.log('✅ Task 4.1 & 4.2 Verification Passed: Cash Book running balances and Bank Statement reconciliation are valid.');
}

verifyBankReconciliation()
    .catch((err) => {
        console.error('❌ Task 4.1 & 4.2 Verification Failed:', err);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
