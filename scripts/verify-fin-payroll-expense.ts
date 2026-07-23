import { PrismaClient } from '@prisma/client';
import { PayrollExpenseService } from '../src/services/finance/payroll-expense.service';

const prisma = new PrismaClient();

async function verifyPayrollExpensePosting() {
    console.log('--- Starting Finance Verification: Task 6.1 & 6.2 (HO Payroll Expense Allocation) ---');

    await prisma.$transaction(async (tx) => {
        const period = '2026-01';
        const amount = 850000;

        const record = await PayrollExpenseService.recordPayrollAllocation(tx, {
            period,
            amount,
            referenceNumber: `HO-PAY-TEST-${Date.now().toString().slice(-4)}`,
            notes: 'Head Office Monthly Staff Cost Allocation Test'
        });

        if (!record) throw new Error('FAILED: Payroll allocation returned null');

        console.log(`Created Payroll Expense Record: ID ${record.id}, Period ${record.period}, Amount LKR ${record.amount}`);

        // Verify GL journal entry
        const entry = await tx.journalEntry.findFirst({
            where: { referenceId: record.id }
        });
        if (!entry) throw new Error('FAILED: GL journal entry for payroll allocation not found');

        const lines = await tx.journalLine.findMany({ where: { entryId: entry.id } });
        console.log(`Posted ${lines.length} payroll journal lines:`);
        for (const l of lines) {
            console.log(`  ${l.accountCode} (${l.accountName}): DR ${l.debit} | CR ${l.credit}`);
        }

        const expLine = lines.find(l => l.accountCode === 'EXP-STAFF-6020');
        const hoLine = lines.find(l => l.accountCode === 'HO-CLR-9010');

        if (!expLine || Number(expLine.debit) !== 850000) {
            throw new Error('FAILED: DR EXP-STAFF-6020 !== 850,000');
        }
        if (!hoLine || Number(hoLine.credit) !== 850000) {
            throw new Error('FAILED: CR HO-CLR-9010 !== 850,000');
        }
    });

    console.log('✅ Task 6.1 & 6.2 Verification Passed: Head Office Payroll Expense allocation posted DR Staff Expense / CR HO Clearing correctly.');
}

verifyPayrollExpensePosting()
    .catch((err) => {
        console.error('❌ Task 6.1 & 6.2 Verification Failed:', err);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
