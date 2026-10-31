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
    static async getActiveBankAccounts() {
        return prisma.bankAccount.findMany({
            where: { isActive: true },
            select: { id: true, accountNumber: true, bankName: true },
            orderBy: { accountNumber: 'asc' },
        });
    }
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
        return prisma.$transaction(async (tx) => {
            // Serialize both rows so two concurrent operators cannot match the same
            // statement or GL line and silently create a false reconciliation.
            await tx.$queryRaw`SELECT id FROM "BankStatementLine" WHERE id = ${statementLineId}::uuid FOR UPDATE`;
            await tx.$queryRaw`SELECT id FROM "JournalLine" WHERE id = ${journalLineId}::uuid FOR UPDATE`;

            const statementLine = await tx.bankStatementLine.findUnique({
                where: { id: statementLineId },
                include: { bankAccount: { select: { glAccountCode: true } } },
            });
            if (!statementLine) throw AppError.notFound(`Statement line #${statementLineId} not found`);
            if (statementLine.isReconciled) {
                throw AppError.conflict(`Statement line #${statementLineId} is already reconciled`);
            }

            const journalLine = await tx.journalLine.findUnique({
                where: { id: journalLineId },
                include: { entry: { select: { status: true } } },
            });
            if (!journalLine) throw AppError.notFound(`Journal line #${journalLineId} not found`);
            if (journalLine.entry.status !== 'POSTED') {
                throw AppError.badRequest('Only POSTED journal lines can be reconciled');
            }
            if (journalLine.accountCode !== statementLine.bankAccount.glAccountCode) {
                throw AppError.badRequest('Journal line does not belong to the selected bank account');
            }

            const statementNet = Number(statementLine.debit) - Number(statementLine.credit);
            const journalNet = Number(journalLine.debit) - Number(journalLine.credit);
            if (!Number.isFinite(statementNet) || !Number.isFinite(journalNet) || Math.abs(statementNet - journalNet) >= 0.01) {
                throw AppError.badRequest('Statement and journal amounts do not match');
            }

            const alreadyMatched = await tx.bankStatementLine.findFirst({
                where: { reconciledJournalLineId: journalLineId },
                select: { id: true },
            });
            if (alreadyMatched) {
                throw AppError.conflict(`Journal line #${journalLineId} is already reconciled`);
            }

            return tx.bankStatementLine.update({
                where: { id: statementLineId },
                data: {
                    isReconciled: true,
                    reconciledJournalLineId: journalLineId,
                    reconciledAt: new Date(),
                },
            });
        });
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
                entry: { status: 'POSTED' }
            }
        });

        let reconciledGlBalance = 0;
        for (const l of glLines) {
            reconciledGlBalance += Number(l.debit) - Number(l.credit);
        }

        const matchedJournalIds = new Set(statementLines.filter(line => line.isReconciled && line.reconciledJournalLineId).map(line => line.reconciledJournalLineId));
        const unreconciledGlCount = glLines.filter(line => !matchedJournalIds.has(line.id)).length;
        const variance = Math.abs(statementBalance - reconciledGlBalance);
        const isReconciled = statementLines.length > 0 && variance < 0.01 && unreconciledStatementCount === 0 && unreconciledGlCount === 0;

        return {
            bankAccountId: bankAccount.id,
            accountNumber: bankAccount.accountNumber,
            bankName: bankAccount.bankName,
            statementBalance,
            reconciledGlBalance,
            unreconciledStatementCount,
            unreconciledGlCount,
            variance,
            isReconciled
        };
    }
}
