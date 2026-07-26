import { prisma } from '@/lib/prisma';
import { AppError } from '@/lib/error';
import { ACCOUNTS } from './account-codes';

export interface BankStatementRow {
    date: Date;
    description: string;
    referenceNumber: string;
    amount: number; // positive = credit to bank (deposit), negative = debit from bank (withdrawal)
}

export interface ReconciliationResult {
    matchedCount: number;
    unmatchedCount: number;
    matches: {
        statementRow: BankStatementRow;
        journalLineId: string;
        journalReference: string;
    }[];
    unmatchedRows: BankStatementRow[];
}

export class BankReconciliationService {
    /**
     * Auto-match bank statement rows against General Ledger Bank Account (1001).
     * Compares the amounts and dates (with a tolerance of +/- 3 days).
     */
    static async autoReconcileStatement(rows: BankStatementRow[]): Promise<ReconciliationResult> {
        if (!rows || rows.length === 0) {
            throw AppError.badRequest('No statement rows provided');
        }

        // Fetch unreconciled bank journal lines from the last 90 days to optimize search space
        const ninetyDaysAgo = new Date();
        ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

        // In a real system, you'd have a `isReconciled` flag. For now we match based on date and amount.
        const bankLedgerLines = await prisma.journalLine.findMany({
            where: {
                accountCode: ACCOUNTS.BANK,
                entry: {
                    date: { gte: ninetyDaysAgo },
                    status: 'POSTED'
                }
            },
            include: {
                entry: true
            }
        });

        const result: ReconciliationResult = {
            matchedCount: 0,
            unmatchedCount: 0,
            matches: [],
            unmatchedRows: []
        };

        const usedJournalLineIds = new Set<string>();

        for (const row of rows) {
            // Find a matching ledger line
            // Bank Statement amount: Positive means Bank received money (DR to Bank in GL)
            // Negative means Bank paid money (CR to Bank in GL)
            let matchFound = false;

            for (const line of bankLedgerLines) {
                if (usedJournalLineIds.has(line.id)) continue;

                // Match Logic:
                // If statement row is positive (Deposit), GL line should have Debit == row.amount
                // If statement row is negative (Withdrawal), GL line should have Credit == Math.abs(row.amount)
                
                const isDeposit = row.amount > 0;
                const matchAmount = Math.abs(row.amount);
                
                const amountMatches = isDeposit 
                    ? (Number(line.debit) === matchAmount) 
                    : (Number(line.credit) === matchAmount);

                if (amountMatches) {
                    // Check date tolerance (+/- 3 days)
                    const lineDate = new Date(line.entry.date);
                    const diffTime = Math.abs(lineDate.getTime() - row.date.getTime());
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                    if (diffDays <= 3) {
                        // Matched!
                        usedJournalLineIds.add(line.id);
                        result.matches.push({
                            statementRow: row,
                            journalLineId: line.id,
                            journalReference: line.entry.referenceId || line.entry.id
                        });
                        result.matchedCount++;
                        matchFound = true;
                        break;
                    }
                }
            }

            if (!matchFound) {
                result.unmatchedRows.push(row);
                result.unmatchedCount++;
            }
        }

        return result;
    }
}
