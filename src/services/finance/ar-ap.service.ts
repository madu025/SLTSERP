import { prisma } from '@/lib/prisma';
import { LedgerService } from './ledger.service';
import { AppError } from '@/lib/error';
import { TransactionClient } from '../inventory/types';

export interface CustomerReceiptPayload {
    receiptNumber?: string;
    customerId?: string;
    invoiceId?: string;
    amount: number;
    paymentMethod?: 'BANK_TRANSFER' | 'CHEQUE' | 'CASH';
    referenceNumber?: string;
    receiptDate?: Date;
    notes?: string;
    createdById?: string;
}

export interface AgingBucket {
    current: number;    // 0-30 days
    days31to60: number; // 31-60 days
    days61to90: number; // 61-90 days
    over90: number;     // 90+ days
    total: number;
}

export interface ArAgingCustomerRow {
    customerId: string;
    customerName: string;
    current: number;
    days31to60: number;
    days61to90: number;
    over90: number;
    totalBalance: number;
}

export interface ArAgingReport {
    summary: AgingBucket;
    glControlBalance: number;
    isReconciled: boolean;
    customers: ArAgingCustomerRow[];
}

export interface ApAgingVendorRow {
    vendorId: string;
    vendorName: string;
    current: number;
    days31to60: number;
    days61to90: number;
    over90: number;
    totalBalance: number;
}

export interface ApAgingReport {
    summary: AgingBucket;
    glControlBalance: number;
    isReconciled: boolean;
    vendors: ApAgingVendorRow[];
}

export class ArApService {
    /**
     * Record a Customer Receipt/Collection, settle invoice balance, and post DR Bank / CR AR.
     */
    static async recordCustomerReceipt(tx: TransactionClient, payload: CustomerReceiptPayload) {
        const { invoiceId, customerId, amount, paymentMethod, referenceNumber, receiptDate, createdById, notes } = payload;

        if (amount <= 0) {
            throw AppError.badRequest('Receipt amount must be greater than zero');
        }

        let invoice = null;
        if (invoiceId) {
            invoice = await tx.projectInvoice.findUnique({ where: { id: invoiceId } });
            if (!invoice) throw AppError.notFound(`Invoice #${invoiceId} not found`);
        }

        const receiptNo = payload.receiptNumber || `RCT-${Date.now().toString().slice(-6)}`;

        // 1. Create Receipt Record
        const receipt = await tx.customerReceipt.create({
            data: {
                receiptNumber: receiptNo,
                customerId: customerId || null,
                invoiceId: invoiceId || null,
                amount,
                paymentMethod: paymentMethod || 'BANK_TRANSFER',
                referenceNumber,
                receiptDate: receiptDate || new Date(),
                notes,
                createdById
            }
        });

        // 2. Update Invoice settlement balances
        if (invoice) {
            const newPaid = invoice.paidAmount + amount;
            const newBalance = Math.max(0, invoice.totalAmount - newPaid);
            const newStatus = newBalance === 0 ? 'PAID' : 'PARTIALLY_PAID';

            await tx.projectInvoice.update({
                where: { id: invoiceId },
                data: {
                    paidAmount: newPaid,
                    balanceAmount: newBalance,
                    status: newStatus
                }
            });
        }

        // 3. Post Double-Entry Journal: DR Bank (BANK-1000) / CR AR-1110
        await LedgerService.postTransaction(tx, {
            referenceId: receipt.id,
            referenceType: 'CUSTOMER_RECEIPT',
            description: notes || `Customer Receipt #${receiptNo} payment collection`,
            date: receiptDate || new Date(),
            createdById,
            lines: [
                {
                    accountCode: 'BANK-1000',
                    debit: amount,
                    credit: 0,
                    description: `Receipt #${receiptNo} deposited into Bank`
                },
                {
                    accountCode: 'AR-1110',
                    debit: 0,
                    credit: amount,
                    description: `AR settlement for Receipt #${receiptNo}`
                }
            ]
        });

        return receipt;
    }

    /**
     * Compute Accounts Receivable (AR) Aging Report across all unpaid project invoices.
     */
    static async getArAgingReport(): Promise<ArAgingReport> {
        const unpaidInvoices = await prisma.projectInvoice.findMany({
            where: {
                balanceAmount: { gt: 0 },
                status: { notIn: ['CANCELLED', 'PAID'] }
            },
            include: {
                project: true
            }
        });

        const today = new Date();
        const summary: AgingBucket = { current: 0, days31to60: 0, days61to90: 0, over90: 0, total: 0 };
        const customerMap = new Map<string, ArAgingCustomerRow>();

        for (const inv of unpaidInvoices) {
            const ageDays = Math.floor((today.getTime() - new Date(inv.invoiceDate).getTime()) / (1000 * 3600 * 24));
            const balance = Number(inv.balanceAmount);

            const custId = inv.projectId || 'GENERAL_CLIENT';
            const custName = inv.project?.name || 'General Client / SLT';

            if (!customerMap.has(custId)) {
                customerMap.set(custId, {
                    customerId: custId,
                    customerName: custName,
                    current: 0,
                    days31to60: 0,
                    days61to90: 0,
                    over90: 0,
                    totalBalance: 0
                });
            }

            const row = customerMap.get(custId)!;
            row.totalBalance += balance;
            summary.total += balance;

            if (ageDays <= 30) {
                row.current += balance;
                summary.current += balance;
            } else if (ageDays <= 60) {
                row.days31to60 += balance;
                summary.days31to60 += balance;
            } else if (ageDays <= 90) {
                row.days61to90 += balance;
                summary.days61to90 += balance;
            } else {
                row.over90 += balance;
                summary.over90 += balance;
            }
        }

        // Fetch GL AR-1110 control account balance
        const arGlLines = await prisma.journalLine.findMany({
            where: {
                accountCode: 'AR-1110',
                entry: { status: { not: 'REVERSED' } }
            }
        });

        let glControlBalance = 0;
        for (const l of arGlLines) {
            glControlBalance += Number(l.debit) - Number(l.credit);
        }

        const isReconciled = Math.abs(summary.total - glControlBalance) < 0.01;

        return {
            summary,
            glControlBalance,
            isReconciled,
            customers: Array.from(customerMap.values())
        };
    }

    /**
     * Compute Accounts Payable (AP) Aging Report across all unpaid contractor invoices.
     */
    static async getApAgingReport(): Promise<ApAgingReport> {
        const unpaidInvoices = await prisma.invoice.findMany({
            where: {
                status: { in: ['PENDING', 'APPROVED', 'HOLD'] }
            },
            include: {
                contractor: true
            }
        });

        const today = new Date();
        const summary: AgingBucket = { current: 0, days31to60: 0, days61to90: 0, over90: 0, total: 0 };
        const vendorMap = new Map<string, ApAgingVendorRow>();

        for (const inv of unpaidInvoices) {
            const ageDays = Math.floor((today.getTime() - new Date(inv.date).getTime()) / (1000 * 3600 * 24));
            const balance = Number(inv.totalAmount || inv.amount || 0);

            const vendorId = inv.contractorId || 'UNKNOWN_CONTRACTOR';
            const vendorName = inv.contractor?.name || 'Contractor / Vendor';

            if (!vendorMap.has(vendorId)) {
                vendorMap.set(vendorId, {
                    vendorId,
                    vendorName,
                    current: 0,
                    days31to60: 0,
                    days61to90: 0,
                    over90: 0,
                    totalBalance: 0
                });
            }

            const row = vendorMap.get(vendorId)!;
            row.totalBalance += balance;
            summary.total += balance;

            if (ageDays <= 30) {
                row.current += balance;
                summary.current += balance;
            } else if (ageDays <= 60) {
                row.days31to60 += balance;
                summary.days31to60 += balance;
            } else if (ageDays <= 90) {
                row.days61to90 += balance;
                summary.days61to90 += balance;
            } else {
                row.over90 += balance;
                summary.over90 += balance;
            }
        }

        // Fetch GL AP-2010 control account balance
        const apGlLines = await prisma.journalLine.findMany({
            where: {
                accountCode: { in: ['AP-2010', 'AP-VEND-2010', 'AP-CON-2020'] },
                entry: { status: { not: 'REVERSED' } }
            }
        });

        let glControlBalance = 0;
        for (const l of apGlLines) {
            glControlBalance += Number(l.credit) - Number(l.debit);
        }

        const isReconciled = Math.abs(summary.total - glControlBalance) < 0.01;

        return {
            summary,
            glControlBalance,
            isReconciled,
            vendors: Array.from(vendorMap.values())
        };
    }
}
