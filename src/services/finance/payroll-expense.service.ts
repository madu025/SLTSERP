import { prisma } from '@/lib/prisma';
import { LedgerService } from './ledger.service';
import { AppError } from '@/lib/error';
import { TransactionClient } from '../inventory/types';

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
    static async recordPayrollAllocation(tx: TransactionClient, payload: PayrollAllocationPayload) {
        const { period, opmcId, amount, referenceNumber, notes, createdById } = payload;

        if (amount <= 0) {
            throw AppError.badRequest('Payroll allocation amount must be greater than zero');
        }

        const refNo = referenceNumber || `PAYROLL-${period}-${Date.now().toString().slice(-4)}`;

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
        // DR: Staff Cost Expense (OPEX) (EXP-STAFF-6020)
        // CR: Head Office Clearing (HO-CLR-9010)
        const journal = await LedgerService.postTransaction(tx, {
            referenceId: record.id,
            referenceType: 'PAYROLL_ALLOCATION',
            description: notes || `Head Office Payroll Allocation for Period ${period} (${refNo})`,
            date: new Date(),
            createdById,
            lines: [
                {
                    accountCode: 'EXP-STAFF-6020',
                    debit: amount,
                    credit: 0,
                    description: `Staff Cost Expense Allocation for ${period}`
                },
                {
                    accountCode: 'HO-CLR-9010',
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

        const totalAllocated = records.reduce((sum: number, r: { amount: number }) => sum + Number(r.amount), 0);

        return {
            totalAllocated,
            count: records.length,
            records
        };
    }
}
