import { prisma } from '@/lib/prisma';
import { AppError } from '@/lib/error';

export interface CashBookRow {
    id: string;
    entryId: string;
    date: string;
    referenceType: string | null;
    referenceId: string | null;
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
    bankAccountId: string;
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
     * Get Cash Book ledger with running balance for a given Bank or Cash GL Account Code.
     */
    static async getCashBook(glAccountCode: string = 'BANK-1000', fromDate?: Date, toDate?: Date): Promise<CashBookReport> {
        const coa = await prisma.chartOfAccount.findUnique({
            where: { code: glAccountCode }
        });

        const accountName = coa?.name || 'Bank Account';

        // Calculate opening balance before fromDate
        let openingBalance = 0;
        if (fromDate) {
            const priorLines = await prisma.journalLine.findMany({
                where: {
                    accountCode: glAccountCode,
                    entry: {
                        status: { not: 'REVERSED' },
                        date: { lt: fromDate }
                    }
                }
            });
            for (const l of priorLines) {
                openingBalance += Number(l.debit) - Number(l.credit);
            }
        }

        // Fetch target period journal lines
        const dateFilter: any = {};
        if (fromDate) dateFilter.gte = fromDate;
        if (toDate) dateFilter.lte = toDate;

        const periodLines = await prisma.journalLine.findMany({
            where: {
                accountCode: glAccountCode,
                entry: {
                    status: { not: 'REVERSED' },
                    ...(Object.keys(dateFilter).length > 0 && { date: dateFilter })
                }
            },
            include: {
                entry: true
            },
            orderBy: {
                entry: { date: 'asc' }
            }
        });

        let runningBalance = openingBalance;
        let totalDebit = 0;
        let totalCredit = 0;

        const rows: CashBookRow[] = periodLines.map((line) => {
            const debit = Number(line.debit);
            const credit = Number(line.credit);

            totalDebit += debit;
            totalCredit += credit;
            runningBalance += debit - credit;

            return {
                id: line.id,
                entryId: line.entryId,
                date: line.entry.date.toISOString(),
                referenceType: line.entry.referenceType,
                referenceId: line.entry.referenceId,
                description: line.description || line.entry.description,
                debit,
                credit,
                runningBalance
            };
        });

        const netMovement = totalDebit - totalCredit;
        const closingBalance = openingBalance + netMovement;

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
            rows
        };
    }

    /**
     * Import Bank Statement lines for reconciliation.
     */
    static async importBankStatement(
        bankAccountId: string,
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
    static async getBankReconciliationSummary(bankAccountId: string): Promise<BankReconciliationSummary> {
        const bankAccount = await prisma.bankAccount.findUnique({ where: { id: bankAccountId } });
        if (!bankAccount) throw AppError.notFound(`Bank account #${bankAccountId} not found`);

        const statementLines = await prisma.bankStatementLine.findMany({
            where: { bankAccountId }
        });

        let statementBalance = bankAccount.openingBalance;
        let unreconciledStatementCount = 0;

        for (const line of statementLines) {
            statementBalance += Number(line.debit) - Number(line.credit);
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
