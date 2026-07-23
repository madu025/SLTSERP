import { TransactionClient } from '../inventory/types';
import { FiscalPeriodService } from './fiscal-period.service';
import { AppError } from '@/lib/error';
import { ACCOUNTS } from './account-codes';

export interface JournalPostingLineInput {
    accountCode: string;
    debit: number;
    credit: number;
    description?: string;
}

export interface PostTransactionInput {
    referenceId?: string;
    referenceType?: string;
    description: string;
    date?: Date;
    createdById?: string;
    lines: JournalPostingLineInput[];
}

export class LedgerService {
    /**
     * Centralized Gateway: Single Source of Truth posting pipeline for all ERP financial events.
     * Enforces double-entry balance integrity, fiscal period lock, CoA account verification, and audit logging.
     */
    static async postTransaction(
        tx: TransactionClient,
        payload: PostTransactionInput
    ) {
        const postingDate = payload.date ? new Date(payload.date) : new Date();

        // 1. Period Lock Enforcement (skip for formal YEAR_END_CLOSE entries)
        if (payload.referenceType !== 'YEAR_END_CLOSE') {
            await FiscalPeriodService.assertPeriodOpen(tx, postingDate);
        }

        // 2. Validate double-entry mathematical integrity (DR == CR)
        let totalDebit = 0;
        let totalCredit = 0;

        for (const line of payload.lines) {
            if (line.debit < 0 || line.credit < 0) {
                throw AppError.badRequest('Journal line debit and credit amounts must be non-negative');
            }
            totalDebit += Number(line.debit);
            totalCredit += Number(line.credit);
        }

        if (Math.abs(totalDebit - totalCredit) > 0.001) {
            throw AppError.badRequest(
                `Unbalanced Journal Entry: Total Debit (${totalDebit.toFixed(2)}) !== Total Credit (${totalCredit.toFixed(2)})`
            );
        }

        if (payload.lines.length === 0) {
            throw AppError.badRequest('Journal Entry must contain at least one line');
        }

        // 3. Dynamic Chart of Accounts lookup, resolution & validation.
        //    Reject unknown or non-postable codes so transactions can never vanish
        //    from the Trial Balance / P&L / Balance Sheet due to a phantom account.
        const resolvedLines = [];
        for (const line of payload.lines) {
            const coa = await tx.chartOfAccount.findUnique({
                where: { code: line.accountCode }
            });

            if (!coa) {
                throw AppError.badRequest(
                    `Unknown account code '${line.accountCode}'. It is not defined in the Chart of Accounts.`
                );
            }
            if (!coa.isPostable) {
                throw AppError.badRequest(
                    `Account '${line.accountCode}' is a non-postable (header) account and cannot be posted to directly.`
                );
            }
            if (!coa.isActive) {
                throw AppError.badRequest(
                    `Account '${line.accountCode}' is inactive and cannot accept new postings.`
                );
            }

            resolvedLines.push({
                accountCode: line.accountCode,
                accountName: coa.name,
                debit: line.debit,
                credit: line.credit,
                description: line.description || payload.description
            });
        }

        // 4. Create locked, audit-trailed Journal Entry
        return await tx.journalEntry.create({
            data: {
                referenceId: payload.referenceId || null,
                referenceType: payload.referenceType || null,
                description: payload.description,
                date: postingDate,
                status: 'POSTED',
                isLocked: true,
                postedAt: new Date(),
                createdById: payload.createdById || null,
                lines: {
                    create: resolvedLines
                }
            },
            include: {
                lines: true
            }
        });
    }

    /**
     * Reverses an existing posted transaction, creating a reversing journal entry that nets original lines to zero.
     */
    static async reverseTransaction(
        tx: TransactionClient,
        originalEntryId: string,
        reversalReason: string,
        createdById?: string
    ) {
        const original = await tx.journalEntry.findUnique({
            where: { id: originalEntryId },
            include: { lines: true }
        });

        if (!original) {
            throw AppError.notFound(`Original journal entry '${originalEntryId}' not found`);
        }

        if (original.status === 'REVERSED') {
            throw AppError.badRequest(`Journal entry '${originalEntryId}' has already been reversed`);
        }

        // Swap debits and credits for reversal lines
        const reversalLines: JournalPostingLineInput[] = original.lines.map((line) => ({
            accountCode: line.accountCode,
            debit: Number(line.credit),
            credit: Number(line.debit),
            description: `Reversal of line: ${line.description || ''}`
        }));

        // Post reversal transaction
        const reversalEntry = await this.postTransaction(tx, {
            referenceId: original.referenceId || originalEntryId,
            referenceType: `REVERSAL_${original.referenceType || 'JOURNAL'}`,
            description: `REVERSAL: ${reversalReason} (Ref: ${original.id})`,
            createdById,
            lines: reversalLines
        });

        // Mark original as REVERSED
        await tx.journalEntry.update({
            where: { id: originalEntryId },
            data: {
                status: 'REVERSED',
                reversalOfId: reversalEntry.id
            }
        });

        return reversalEntry;
    }

    /**
     * Log double-entry entry for GRN item receipt (Purchase Receipt Accrual)
     * DR: Raw Material Inventory (INV-1010)
     * CR: Accrued Accounts Payable / Inventory Received Uninvoiced (AP-2010)
     */
    static async logGrnReceipt(
        tx: TransactionClient,
        grnId: string,
        totalCost: number,
        description?: string
    ) {
        if (totalCost <= 0) return null;
        return await this.postTransaction(tx, {
            referenceId: grnId,
            referenceType: 'GRN',
            description: description || `GRN Receipt Entry for GRN ID: ${grnId}`,
            lines: [
                { accountCode: 'INV-1010', debit: totalCost, credit: 0, description: 'Inventory received in stores' },
                { accountCode: 'AP-2010', debit: 0, credit: totalCost, description: 'Accrued inventory uninvoiced' }
            ]
        });
    }

    /**
     * Log double-entry for SOD Material Consumption (Cost of Goods Sold)
     * DR: Cost of Goods Sold - COGS (COGS-5010)
     * CR: Raw Material Inventory (INV-1010)
     */
    static async logSodConsumption(
        tx: TransactionClient,
        sodId: string,
        totalCost: number,
        description?: string
    ) {
        if (totalCost <= 0) return null;

        const desc = description || `Material Consumption for SOD ID: ${sodId}`;
        return await this.postTransaction(tx, {
            referenceId: sodId,
            referenceType: 'SOD_CONSUMPTION',
            description: desc,
            lines: [
                {
                    accountCode: ACCOUNTS.COGS,
                    debit: totalCost,
                    credit: 0,
                    description: 'Cost of materials installed on service order'
                },
                {
                    accountCode: ACCOUNTS.INVENTORY,
                    debit: 0,
                    credit: totalCost,
                    description: 'Deduction of materials consumed'
                }
            ]
        });
    }

    /**
     * Log double-entry for SOD Accrued Billing Revenue
     * DR: Accrued Invoicing Revenue / Accounts Receivable (AR-1110)
     * CR: Accrued Services Revenue (REV-4010)
     */
    static async logSodRevenue(
        tx: TransactionClient,
        sodId: string,
        revenueAmount: number,
        description?: string
    ) {
        if (revenueAmount <= 0) return null;

        const desc = description || `Accrued Revenue for Completed SOD: ${sodId}`;
        return await this.postTransaction(tx, {
            referenceId: sodId,
            referenceType: 'SOD_REVENUE',
            description: desc,
            lines: [
                {
                    accountCode: ACCOUNTS.AR_CLIENT,
                    debit: revenueAmount,
                    credit: 0,
                    description: 'Accrued billing revenue for completed service connection'
                },
                {
                    accountCode: ACCOUNTS.REVENUE,
                    debit: 0,
                    credit: revenueAmount,
                    description: 'Recognized service revenue'
                }
            ]
        });
    }

    /**
     * Log double-entry for Wastage / Scrap Write-Offs
     * DR: Material Wastage & Scrap Expense (EXP-WASTAGE-5030)
     * CR: Raw Material Inventory (INV-1010)
     */
    static async logWastage(
        tx: TransactionClient,
        wastageId: string,
        totalCost: number,
        description?: string
    ) {
        if (totalCost <= 0) return null;

        const desc = description || `Material Wastage Write-Off for ID: ${wastageId}`;
        return await this.postTransaction(tx, {
            referenceId: wastageId,
            referenceType: 'WASTAGE',
            description: desc,
            lines: [
                {
                    accountCode: ACCOUNTS.WASTAGE_EXPENSE,
                    debit: totalCost,
                    credit: 0,
                    description: 'Inventory write-off due to scrap/damage'
                },
                {
                    accountCode: ACCOUNTS.INVENTORY,
                    debit: 0,
                    credit: totalCost,
                    description: 'Deduction of scrap/damaged materials'
                }
            ]
        });
    }

    /**
     * Rollback/Reverse Ledger Entries for a returned or cancelled SOD.
     * Posts a balanced reversing entry (through the gateway) for each original entry,
     * and marks each original as REVERSED. Entries that are themselves reversals or
     * already reversed are skipped so a repeated sync can never double-reverse.
     */
    static async rollbackSodTransaction(
        tx: TransactionClient,
        sodId: string,
        description?: string
    ) {
        const desc = description || `Reversal Entry for Cancelled/Returned SOD ID: ${sodId}`;

        // Find existing (non-reversed, non-reversal) journal entries for this SOD
        const entries = await tx.journalEntry.findMany({
            where: {
                referenceId: sodId,
                status: { not: 'REVERSED' }
            },
            include: { lines: true }
        });

        for (const entry of entries) {
            // Never reverse an entry that is itself a reversal.
            if (entry.referenceType && entry.referenceType.includes('REVERSAL')) {
                continue;
            }

            await this.reverseTransaction(
                tx,
                entry.id,
                `${desc} (Original: ${entry.description})`,
                entry.createdById || undefined
            );
        }
    }

    static async logCostAllocationMemo(
        tx: TransactionClient,
        memoId: string,
        totalCost: number,
        allocationTarget: string,
        description?: string
    ) {
        if (totalCost <= 0) return null;

        const desc = description || `Cost Allocation via Memo for ${allocationTarget}`;
        return await this.postTransaction(tx, {
            referenceId: memoId,
            referenceType: 'COST_ALLOCATION_MEMO',
            description: desc,
            lines: [
                {
                    accountCode: ACCOUNTS.OSP_EXPENSE,
                    debit: totalCost,
                    credit: 0,
                    description: `Cost allocated to ${allocationTarget}`
                },
                {
                    accountCode: ACCOUNTS.HO_CLEARING_LEGACY,
                    debit: 0,
                    credit: totalCost,
                    description: `Clearing entry for asset purchase`
                }
            ]
        });
    }

    /**
     * Log double-entry for MRN Item Return (Return to Vendor)
     * DR: Accrued Accounts Payable (AP-2010)
     * CR: Raw Material Inventory (INV-1010)
     */
    static async logMrnReturn(
        tx: TransactionClient,
        mrnId: string,
        totalCost: number,
        description?: string
    ) {
        if (totalCost <= 0) return null;

        const desc = description || `MRN Return Entry for MRN ID: ${mrnId}`;
        return await this.postTransaction(tx, {
            referenceId: mrnId,
            referenceType: 'MRN',
            description: desc,
            lines: [
                {
                    accountCode: ACCOUNTS.AP_ACCRUED,
                    debit: totalCost,
                    credit: 0,
                    description: 'Accrued liability reduced due to return'
                },
                {
                    accountCode: ACCOUNTS.INVENTORY,
                    debit: 0,
                    credit: totalCost,
                    description: 'Inventory returned to supplier'
                }
            ]
        });
    }

    /**
     * Log double-entry for Petty Cash Expense approval
     * DR: Relevant Expense Account based on category (TRANSPORT, REFRESHMENTS, UTILITIES, STATIONERY, MISC)
     * CR: Petty Cash Imprest Account (PETTY-1020)
     */
    static async logPettyCashExpense(
        tx: TransactionClient,
        voucherId: string,
        amount: number,
        category: string,
        description?: string
    ) {
        if (amount <= 0) return null;

        // All operational petty-cash categories map to the single G&A petty cash
        // expense account defined in the Chart of Accounts; the specific category is
        // preserved in the line description for reporting/drill-down.
        const desc = description || `Petty Cash Expense for Category ${category}, Voucher ID: ${voucherId}`;
        return await this.postTransaction(tx, {
            referenceId: voucherId,
            referenceType: 'PETTY_CASH_EXPENSE',
            description: desc,
            lines: [
                {
                    accountCode: ACCOUNTS.PETTY_CASH_EXPENSE,
                    debit: amount,
                    credit: 0,
                    description: `Petty cash local site expense (${category})`
                },
                {
                    accountCode: ACCOUNTS.PETTY_CASH,
                    debit: 0,
                    credit: amount,
                    description: 'Cash spent from site petty cash'
                }
            ]
        });
    }

    /**
     * Log double-entry for Petty Cash Imprest Reimbursement (Replenishment)
     * DR: Petty Cash Imprest Account (PETTY-1020)
     * CR: Bank Cash Account (BANK-1000)
     */
    static async logPettyCashReimbursement(
        tx: TransactionClient,
        reimbursementId: string,
        amount: number,
        description?: string
    ) {
        if (amount <= 0) return null;

        const desc = description || `Replenishment of Petty Cash Imprest, ID: ${reimbursementId}`;
        return await this.postTransaction(tx, {
            referenceId: reimbursementId,
            referenceType: 'PETTY_CASH_REIMBURSEMENT',
            description: desc,
            lines: [
                {
                    accountCode: ACCOUNTS.PETTY_CASH,
                    debit: amount,
                    credit: 0,
                    description: 'Funds replenished to site petty cash'
                },
                {
                    accountCode: ACCOUNTS.BANK,
                    debit: 0,
                    credit: amount,
                    description: 'Funds transferred from bank to site cash'
                }
            ]
        });
    }

    /**
     * Log double-entry for Contractor Cost Accrual upon SOD Completion
     * DR: Contractor Direct OSP Expense (EXP-CON-4020)
     * CR: Accrued Contractor Payables (AP-CON-2020)
     */
    static async logContractorAccrual(
        tx: TransactionClient,
        sodId: string,
        amount: number,
        contractorName: string,
        description?: string
    ) {
        if (amount <= 0) return null;

        const desc = description || `Accrued Contractor Cost for Completed SOD: ${sodId} (Contractor: ${contractorName})`;
        return await this.postTransaction(tx, {
            referenceId: sodId,
            referenceType: 'CONTRACTOR_ACCRUAL',
            description: desc,
            lines: [
                {
                    accountCode: ACCOUNTS.CONTRACTOR_EXPENSE,
                    debit: amount,
                    credit: 0,
                    description: 'Accrued contractor service cost'
                },
                {
                    accountCode: ACCOUNTS.AP_CONTRACTOR,
                    debit: 0,
                    credit: amount,
                    description: 'Outstanding liability to contractor'
                }
            ]
        });
    }

    /**
     * Log double-entry for Project Invoice finalization (issued)
     * For Client Invoice:
     *   DR: Accounts Receivable - Client (AR-1110)
     *   CR: Accrued Project & Service Revenue (REV-4010)
     * For Contractor Invoice:
     *   DR: Accrued Contractor Payable (AP-CON-2020)
     *   CR: Trade Accounts Payable - Vendors (AP-VEND-2010)
     */
    static async logInvoiceIssuance(
        tx: TransactionClient,
        invoiceId: string,
        amount: number,
        type: string,
        invoiceNumber: string,
        description?: string
    ) {
        if (amount <= 0) return null;

        const desc = description || `Invoice Finalization: ${invoiceNumber} (${type})`;

        let debitAccountCode: string;
        let creditAccountCode: string;

        if (type.toUpperCase() === 'CLIENT') {
            debitAccountCode = ACCOUNTS.AR_CLIENT;
            creditAccountCode = ACCOUNTS.REVENUE;
        } else { // CONTRACTOR or VENDOR
            debitAccountCode = ACCOUNTS.AP_CONTRACTOR;
            creditAccountCode = ACCOUNTS.AP_VENDOR;
        }

        return await this.postTransaction(tx, {
            referenceId: invoiceId,
            referenceType: 'INVOICE_ISSUANCE',
            description: desc,
            lines: [
                {
                    accountCode: debitAccountCode,
                    debit: amount,
                    credit: 0,
                    description: `Invoice ${invoiceNumber} issued`
                },
                {
                    accountCode: creditAccountCode,
                    debit: 0,
                    credit: amount,
                    description: `Revenue/Liability recorded for ${invoiceNumber}`
                }
            ]
        });
    }

    /**
     * Log double-entry for Payment Voucher payout (status: PAID)
     * For Contractor PV:
     *   DR: Trade Accounts Payable - Vendors (AP-VEND-2010)
     *   CR: Main Bank Account (BANK-1000)
     * For Other PV (Expense/Materials):
     *   DR: G&A Petty Cash Expenses (EXP-PETTY-6040)
     *   CR: Main Bank Account (BANK-1000)
     */
    static async logPaymentVoucherPayment(
        tx: TransactionClient,
        pvId: string,
        amount: number,
        type: string,
        pvNumber: string,
        payeeName: string,
        description?: string
    ) {
        if (amount <= 0) return null;

        const desc = description || `Payment Voucher Paid: ${pvNumber} (Payee: ${payeeName})`;

        // Contractor PVs settle the vendor payable; other PVs hit G&A expense.
        const debitAccountCode = type.toUpperCase() === 'CONTRACTOR'
            ? ACCOUNTS.AP_VENDOR
            : ACCOUNTS.PETTY_CASH_EXPENSE;

        return await this.postTransaction(tx, {
            referenceId: pvId,
            referenceType: 'PV_PAYMENT',
            description: desc,
            lines: [
                {
                    accountCode: debitAccountCode,
                    debit: amount,
                    credit: 0,
                    description: `Payment release to ${payeeName}`
                },
                {
                    accountCode: ACCOUNTS.BANK,
                    debit: 0,
                    credit: amount,
                    description: `Disbursement for PV ${pvNumber}`
                }
            ]
        });
    }

    /**
     * Get paginated ledger entries
     */
    static async getLedgerEntries(pagination?: { page?: number; limit?: number }) {
        const { prisma } = await import('@/lib/prisma');
        const page = pagination?.page || 1;
        const limit = pagination?.limit || 50;
        const skip = (page - 1) * limit;

        const [items, total] = await prisma.$transaction([
            prisma.journalEntry.findMany({
                include: { lines: true },
                orderBy: { date: 'desc' },
                skip,
                take: limit
            }),
            prisma.journalEntry.count()
        ]);

        return {
            items,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        };
    }
}
