import { prisma } from '@/lib/prisma';
import { LedgerService } from './ledger.service';
import { AppError } from '@/lib/error';
import { TransactionClient } from '@/types/inventory/inventory-service.types';
import { ACCOUNTS } from './account-codes';
import { AuditLedgerService } from '@/services/inventory/audit-ledger.service';

export interface PayrollAllocationPayload {
    period: string; // e.g. "2026-01"
    opmcId?: string;
    amount: number;
    referenceNumber?: string;
    notes?: string;
    createdById?: string;
}

export class PayrollExpenseService {
    /**
     * Record a Head Office Payroll Expense allocation and post DR Staff Cost / CR HO Clearing via Central Gateway.
     */
    static async recordPayrollAllocation(payload: PayrollAllocationPayload) {
        return await prisma.$transaction(async (tx) => {
            const { period, opmcId, amount, referenceNumber, notes, createdById } = payload;

            if (amount <= 0) {
                throw AppError.badRequest('Payroll allocation amount must be greater than zero');
            }

            const refNo = referenceNumber || await AuditLedgerService.getNextDocumentNumber('PAYROLL', tx);

            // 1. Create PayrollExpense Record
            const record = await tx.payrollExpense.create({
                data: {
                    period,
                    opmcId,
                    amount,
                    referenceNumber: refNo,
                    notes,
                    status: 'POSTED',
                    createdById
                }
            });

            // 2. Post Double-Entry Journal via Central Gateway:
            // DR: Staff Cost Expense (OPEX) (EXP-STAFF-6010)
            // CR: Head Office Clearing (HO-CLEARING-2500)
            const journal = await LedgerService.postTransaction(tx, {
                referenceId: record.id,
                referenceType: 'PAYROLL_ALLOCATION',
                description: notes || `Head Office Payroll Allocation for Period ${period} (${refNo})`,
                date: new Date(),
                createdById,
                lines: [
                    {
                        accountCode: ACCOUNTS.STAFF_EXPENSE,
                        debit: amount,
                        credit: 0,
                        description: `Staff Cost Expense Allocation for ${period}`
                    },
                    {
                        accountCode: ACCOUNTS.HO_CLEARING,
                        debit: 0,
                        credit: amount,
                        description: `Head Office Clearing for ${period} Payroll`
                    }
                ]
            });

            // Update postedJournalId on record
            await tx.payrollExpense.update({
                where: { id: record.id },
                data: { postedJournalId: journal.id }
            });

            return record;
        });
    }

    /**
     * Get list of recorded HO payroll allocations.
     */
    static async getPayrollExpenses(opmcId?: string, period?: string) {
        const where: Record<string, unknown> = {};
        if (opmcId) where.opmcId = opmcId;
        if (period) where.period = period;

        const records = await prisma.payrollExpense.findMany({
            where,
            orderBy: { createdAt: 'desc' }
        });

        const totalAllocated = records.reduce((sum: number, r) => sum + Number(r.amount), 0);

        return {
            totalAllocated,
            count: records.length,
            records
        };
    }
}
