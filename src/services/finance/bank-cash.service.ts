import { prisma } from '@/lib/prisma';
import { AppError } from '@/lib/error';
import { ACCOUNTS } from './account-codes';
import { UUID } from '@/types/common';

export interface CashBookRow {
    id: UUID;
    entryId: UUID;
    date: Date;
    referenceType: string | null;
    referenceId: UUID | null;
    description: string;
    debit: number;
    credit: number;
    runningBalance: number;
}

export interface CashBookReport {
    glAccountCode: string;
    accountName: string;
    fromDate?: string;
    toDate?: string;
    openingBalance: number;
    totalDebit: number;
    totalCredit: number;
    netMovement: number;
    closingBalance: number;
    rows: CashBookRow[];
}

export interface BankReconciliationSummary {
    bankAccountId: UUID;
    accountNumber: string;
    bankName: string;
    statementBalance: number;
    reconciledGlBalance: number;
    unreconciledStatementCount: number;
    unreconciledGlCount: number;
    variance: number;
    isReconciled: boolean;
}

export class BankCashService {
    /**
     * Get Cash Book ledger with running balance via DB function fn_cash_book_report().
     * Replaces JS loop with PostgreSQL window functions for O(1) DB round-trip.
     */
    static async getCashBook(glAccountCode: string = ACCOUNTS.BANK, fromDate?: Date, toDate?: Date): Promise<CashBookReport> {
        const coa = await prisma.chartOfAccount.findUnique({
            where: { code: glAccountCode }
        });

        const accountName = coa?.name || 'Bank Account';

        // Delegate to DB function -- runs opening balance + running balance in single query
        const rows = await prisma.$queryRaw<{
            id: string;
            entry_id: string;
            entry_date: Date;
            reference_type: string | null;
            reference_id: string | null;
            description: string;
            debit: number;
            credit: number;
            running_balance: number;
        }[]>`
            SELECT * FROM fn_cash_book_report(
                ${glAccountCode},
                ${fromDate || null}::TIMESTAMP,
                ${toDate || null}::TIMESTAMP
            )
        `;

        // Calculate summary totals from DB result
        const totalDebit = rows.reduce((sum, r) => sum + Number(r.debit), 0);
        const totalCredit = rows.reduce((sum, r) => sum + Number(r.credit), 0);
        const openingBalance = rows.length > 0
            ? Number(rows[0].running_balance) - Number(rows[0].debit) + Number(rows[0].credit)
            : 0;
        const closingBalance = rows.length > 0
            ? Number(rows[rows.length - 1].running_balance)
            : openingBalance;
        const netMovement = totalDebit - totalCredit;

        const mappedRows: CashBookRow[] = rows.map((r) => ({
            id: r.id,
            entryId: r.entry_id,
            date: r.entry_date,
            referenceType: r.reference_type,
            referenceId: r.reference_id,
            description: r.description,
            debit: Number(r.debit),
            credit: Number(r.credit),
            runningBalance: Number(r.running_balance)
        }));

        return {
            glAccountCode,
            accountName,
            fromDate: fromDate?.toISOString(),
            toDate: toDate?.toISOString(),
            openingBalance,
            totalDebit,
            totalCredit,
            netMovement,
            closingBalance,
            rows: mappedRows
        };
    }

    /**
     * Import Bank Statement lines for reconciliation.
     */
    static async importBankStatement(
        bankAccountId: UUID,
        lines: { statementDate: Date; description: string; referenceNumber?: string; debit: number; credit: number }[]
    ) {
        const bankAccount = await prisma.bankAccount.findUnique({ where: { id: bankAccountId } });
        if (!bankAccount) throw AppError.notFound(`Bank account #${bankAccountId} not found`);

        const createdLines = await prisma.bankStatementLine.createMany({
            data: lines.map((l) => ({
                bankAccountId,
                statementDate: l.statementDate,
                description: l.description,
                referenceNumber: l.referenceNumber,
                debit: l.debit,
                credit: l.credit
            }))
        });

        return createdLines;
    }

    /**
     * Reconcile a bank statement line with a GL journal line.
     */
    static async reconcileStatementLine(statementLineId: string, journalLineId: string) {
        const statementLine = await prisma.bankStatementLine.findUnique({ where: { id: statementLineId } });
        if (!statementLine) throw AppError.notFound(`Statement line #${statementLineId} not found`);

        const journalLine = await prisma.journalLine.findUnique({ where: { id: journalLineId } });
        if (!journalLine) throw AppError.notFound(`Journal line #${journalLineId} not found`);

        const updated = await prisma.bankStatementLine.update({
            where: { id: statementLineId },
            data: {
                isReconciled: true,
                reconciledJournalLineId: journalLineId,
                reconciledAt: new Date()
            }
        });

        return updated;
    }

    /**
     * Compute Bank Reconciliation summary & variance.
     */
    static async getBankReconciliationSummary(bankAccountId: UUID): Promise<BankReconciliationSummary> {
        const bankAccount = await prisma.bankAccount.findUnique({ where: { id: bankAccountId } });
        if (!bankAccount) throw AppError.notFound(`Bank account #${bankAccountId} not found`);

        const statementLines = await prisma.bankStatementLine.findMany({
            where: { bankAccountId }
        });

        let statementBalance = Number(bankAccount.openingBalance);
        let unreconciledStatementCount = 0;

        for (const line of statementLines) {
            statementBalance += Number(line.debit.toNumber()) - Number(line.credit.toNumber());
            if (!line.isReconciled) unreconciledStatementCount++;
        }

        // Compute GL bank balance for account
        const glLines = await prisma.journalLine.findMany({
            where: {
                accountCode: bankAccount.glAccountCode,
                entry: { status: { not: 'REVERSED' } }
            }
        });

        let reconciledGlBalance = 0;
        for (const l of glLines) {
            reconciledGlBalance += Number(l.debit) - Number(l.credit);
        }

        const variance = Math.abs(statementBalance - reconciledGlBalance);
        const isReconciled = variance < 0.01;

        return {
            bankAccountId: bankAccount.id,
            accountNumber: bankAccount.accountNumber,
            bankName: bankAccount.bankName,
            statementBalance,
            reconciledGlBalance,
            unreconciledStatementCount,
            unreconciledGlCount: glLines.length,
            variance,
            isReconciled
        };
    }
}
