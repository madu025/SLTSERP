import { prisma } from '@/lib/prisma';
import { LedgerService } from './ledger.service';
import { FiscalPeriodService } from './fiscal-period.service';
import { LedgerReportService } from './ledger-report.service';
import { FiscalPeriodStatus } from '@prisma/client';
import { AppError } from '@/lib/error';
import { TransactionClient } from '@/types/inventory/inventory-service.types';
import { ACCOUNTS } from './account-codes';
import { AuditLedgerService } from '@/services/inventory/audit-ledger.service';

export interface CreditDebitNotePayload {
    noteNumber?: string;
    type?: 'CREDIT_NOTE' | 'DEBIT_NOTE';
    invoiceId?: string;
    amount: number;
    reason: string;
    createdById?: string;
}

export class PeriodCloseService {
    /**
     * Execute formal Year-End Close: zero P&L accounts, roll Net Profit into Retained Earnings (EQU-RET-3010), and lock periods.
     */
    static async executeYearEndClose(year: number, closedById?: string) {
        return await prisma.$transaction(async (tx) => {
            // 1. Fetch Trial Balance for the entire fiscal year
            const fromDate = new Date(year, 0, 1);
            const toDate = new Date(year, 11, 31, 23, 59, 59);

            const tb = await LedgerReportService.getAccountBalances(fromDate, toDate);

            let totalRevenue = 0;
            let totalExpense = 0;
            const zeroingLines: { accountCode: string; debit: number; credit: number; description: string }[] = [];

            for (const a of tb.accounts) {
                const typeStr = String(a.type);
                if (typeStr === 'REVENUE' && a.totalCredit > 0) {
                    totalRevenue += a.totalCredit;
                    zeroingLines.push({
                        accountCode: a.code,
                        debit: a.totalCredit,
                        credit: 0,
                        description: `Year-End P&L Close for ${a.code}`
                    });
                } else if (typeStr === 'EXPENSE' && a.totalDebit > 0) {
                    totalExpense += a.totalDebit;
                    zeroingLines.push({
                        accountCode: a.code,
                        debit: 0,
                        credit: a.totalDebit,
                        description: `Year-End P&L Close for ${a.code}`
                    });
                }
            }

            const netProfit = totalRevenue - totalExpense;

            // Post Net Profit/Loss to Retained Earnings (EQUITY-3000)
            if (netProfit > 0) {
                zeroingLines.push({
                    accountCode: ACCOUNTS.RETAINED_EARNINGS,
                    debit: 0,
                    credit: netProfit,
                    description: `Net Income Rollover to Retained Earnings FY ${year}`
                });
            } else if (netProfit < 0) {
                zeroingLines.push({
                    accountCode: ACCOUNTS.RETAINED_EARNINGS,
                    debit: Math.abs(netProfit),
                    credit: 0,
                    description: `Net Loss Rollover to Retained Earnings FY ${year}`
                });
            }

            let journalEntry = null;
            if (zeroingLines.length > 0) {
                journalEntry = await LedgerService.postTransaction(tx, {
                    referenceId: `YEAREND-${year}`,
                    referenceType: 'YEAR_END_CLOSE',
                    description: `Formal Year-End Close and Retained Earnings Rollover FY ${year}`,
                    date: toDate,
                    createdById: closedById,
                    lines: zeroingLines
                });
            }

            // Lock all 12 fiscal periods for the year
            for (let month = 1; month <= 12; month++) {
                await FiscalPeriodService.setPeriodStatus(year, month, FiscalPeriodStatus.LOCKED, closedById);
            }

            return {
                year,
                totalRevenue,
                totalExpense,
                netProfit,
                journalId: journalEntry?.id
            };
        });
    }

    /**
     * Create and post Credit or Debit Note against an invoice.
     */
    static async createCreditDebitNote(payload: CreditDebitNotePayload) {
        return await prisma.$transaction(async (tx) => {
            const { invoiceId, amount, reason, createdById } = payload;
            const noteType = payload.type || 'CREDIT_NOTE';

            if (amount <= 0) {
                throw AppError.badRequest('Note amount must be greater than zero');
            }

            let invoice = null;
            if (invoiceId) {
                invoice = await tx.projectInvoice.findUnique({ where: { id: invoiceId } });
                if (!invoice) throw AppError.notFound(`Invoice #${invoiceId} not found`);
            }

            const docType = noteType === 'CREDIT_NOTE' ? 'CN' : 'DN';
            const noteNo = payload.noteNumber || await AuditLedgerService.getNextDocumentNumber(docType, tx);

            // 1. Create CreditDebitNote Record
            const note = await tx.creditDebitNote.create({
                data: {
                    noteNumber: noteNo,
                    type: noteType,
                    invoiceId: invoiceId || null,
                    amount,
                    reason,
                    status: 'POSTED',
                    createdById
                }
            });

            // 2. Adjust Invoice Balance
            if (invoice) {
                if (noteType === 'CREDIT_NOTE') {
                    const newBalance = Math.max(0, Number(invoice.balanceAmount) - amount);
                    await tx.projectInvoice.update({
                        where: { id: invoiceId },
                        data: { balanceAmount: newBalance }
                    });
                } else {
                    const newBalance = invoice.balanceAmount.toNumber() + amount;
                    await tx.projectInvoice.update({
                        where: { id: invoiceId },
                        data: { balanceAmount: newBalance }
                    });
                }
            }

            // 3. Post Double-Entry Journal:
            // Credit Note: DR Revenue / CR AR
            // Debit Note : DR AR / CR Revenue
            const lines = noteType === 'CREDIT_NOTE' ? [
                {
                    accountCode: ACCOUNTS.REVENUE,
                    debit: amount,
                    credit: 0,
                    description: `Credit Note #${noteNo} revenue adjustment`
                },
                {
                    accountCode: ACCOUNTS.AR_CLIENT,
                    debit: 0,
                    credit: amount,
                    description: `Credit Note #${noteNo} AR balance reduction`
                }
            ] : [
                {
                    accountCode: ACCOUNTS.AR_CLIENT,
                    debit: amount,
                    credit: 0,
                    description: `Debit Note #${noteNo} AR balance increase`
                },
                {
                    accountCode: ACCOUNTS.REVENUE,
                    debit: 0,
                    credit: amount,
                    description: `Debit Note #${noteNo} additional revenue charge`
                }
            ];

            const journal = await LedgerService.postTransaction(tx, {
                referenceId: note.id,
                referenceType: noteType,
                description: reason || `${noteType} #${noteNo} issued`,
                date: new Date(),
                createdById,
                lines
            });

            const updatedNote = await tx.creditDebitNote.update({
                where: { id: note.id },
                data: { postedJournalId: journal.id }
            });

            return updatedNote;
        });
    }

    static async getCreditDebitNotes() {
        return await prisma.creditDebitNote.findMany({
            include: {
                invoice: true
            },
            orderBy: {
                createdAt: 'desc'
            }
        });
    }
}
