import { prisma } from '@/lib/prisma';
import { LedgerService } from './ledger.service';
import { AppError } from '@/lib/error';
import { ACCOUNTS } from './account-codes';
import { AuditLedgerService } from '@/services/inventory/audit-ledger.service';
import { resolveOpmcScope } from '@/lib/opmc-scope';
import { Prisma } from '@prisma/client';

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
    static async recordCustomerReceipt(payload: CustomerReceiptPayload) {
        return await prisma.$transaction(async (tx) => {
            const { invoiceId, customerId, amount, paymentMethod, receiptDate, createdById, notes } = payload;
            const referenceNumber = payload.referenceNumber?.trim();

            if (!Number.isFinite(amount) || amount <= 0) {
                throw AppError.badRequest('Receipt amount must be greater than zero');
            }
            const receiptAmount = new Prisma.Decimal(amount);
            if (receiptAmount.decimalPlaces() > 2 || receiptAmount.gt('999999999999.99')) {
                throw AppError.badRequest('Receipt amount must be an exact monetary amount with at most two decimal places');
            }

            let invoice = null;
            if (invoiceId) {
                if (!referenceNumber) throw AppError.badRequest('BANK_REFERENCE_REQUIRED_FOR_INVOICE_RECEIPT');
                // Serialize settlement and duplicate-reference checks on the invoice row.
                await tx.$queryRaw`SELECT "id" FROM "ProjectInvoice" WHERE "id" = ${invoiceId}::uuid FOR UPDATE`;
                invoice = await tx.projectInvoice.findUnique({ where: { id: invoiceId } });
                if (!invoice) throw AppError.notFound(`Invoice #${invoiceId} not found`);
                if (invoice.type !== 'CLIENT') throw AppError.badRequest('RECEIPT_ONLY_FOR_CLIENT_INVOICES');
                if (invoice.submissionStatus !== 'SUBMITTED_TO_SLT') {
                    throw AppError.badRequest('INVOICE_MUST_BE_SUBMITTED_TO_SLT_BEFORE_RECEIPT');
                }
                if (Number(invoice.balanceAmount) <= 0) throw AppError.badRequest('INVOICE_IS_ALREADY_PAID');
                if (receiptAmount.gt(invoice.balanceAmount)
                    || receiptAmount.gt(new Prisma.Decimal(invoice.totalAmount).minus(invoice.paidAmount))) {
                    throw AppError.badRequest('RECEIPT_AMOUNT_EXCEEDS_INVOICE_BALANCE');
                }
                if (referenceNumber) {
                    const duplicate = await tx.customerReceipt.findFirst({
                        where: { invoiceId, referenceNumber },
                        select: { id: true },
                    });
                    if (duplicate) throw AppError.conflict('A receipt with this bank reference already exists for this invoice');
                }
            }

            const effectiveReceiptDate = receiptDate || new Date();
            if (Number.isNaN(new Date(effectiveReceiptDate).getTime())) {
                throw AppError.badRequest('Receipt date is invalid');
            }

            const receiptNo = payload.receiptNumber || await AuditLedgerService.getNextDocumentNumber('RCT', tx);

            // 1. Create Receipt Record
            const receipt = await tx.customerReceipt.create({
                data: {
                    receiptNumber: receiptNo,
                    customerId: customerId || null,
                    invoiceId: invoiceId || null,
                    amount: receiptAmount,
                    paymentMethod: paymentMethod || 'BANK_TRANSFER',
                    referenceNumber,
                    receiptDate: effectiveReceiptDate,
                    notes,
                    createdById
                }
            });

            // 2. Update Invoice settlement balances
            if (invoice) {
                const newPaid = new Prisma.Decimal(invoice.paidAmount).plus(receiptAmount);
                const newBalance = new Prisma.Decimal(invoice.totalAmount).minus(newPaid);
                const newStatus = newBalance.isZero() ? 'PAID' : 'PARTIALLY_PAID';

                await tx.projectInvoice.update({
                    where: { id: invoiceId },
                    data: {
                        paidAmount: newPaid,
                        balanceAmount: newBalance,
                        status: newStatus,
                        paymentStatus: newStatus,
                        paymentReceivedAt: effectiveReceiptDate,
                        paymentReference: referenceNumber || null,
                    }
                });
            }

            // 3. Post Double-Entry Journal: DR Bank (BANK-1000) / CR AR-1110
            await LedgerService.postTransaction(tx, {
                referenceId: receipt.id,
                referenceType: 'CUSTOMER_RECEIPT',
                description: notes || `Customer Receipt #${receiptNo} payment collection`,
                date: effectiveReceiptDate,
                createdById,
                lines: [
                    {
                        accountCode: ACCOUNTS.BANK,
                        debit: amount,
                        credit: 0,
                        description: `Receipt #${receiptNo} deposited into Bank`
                    },
                    {
                        accountCode: ACCOUNTS.AR_CLIENT,
                        debit: 0,
                        credit: amount,
                        description: `AR settlement for Receipt #${receiptNo}`
                    }
                ]
            });

            return receipt;
        });
    }

    static async getCustomerReceipts(userId?: string | null) {
        const scope = await resolveOpmcScope(userId);
        return await prisma.customerReceipt.findMany({
            where: scope === undefined
                ? undefined
                : { invoice: { project: { opmcId: { in: scope } } } },
            include: {
                customer: true,
                invoice: true
            },
            orderBy: {
                receiptDate: 'desc'
            }
        });
    }

    /**
     * Compute Accounts Receivable (AR) Aging Report across all unpaid project invoices.
     */
    static async getArAgingReport(userId?: string | null): Promise<ArAgingReport> {
        const scope = await resolveOpmcScope(userId);
        const unpaidInvoices = await prisma.projectInvoice.findMany({
            where: {
                ...(scope === undefined ? {} : { project: { opmcId: { in: scope } } }),
                type: 'CLIENT',
                balanceAmount: { gt: 0 },
                paymentStatus: { in: ['PENDING', 'PARTIALLY_PAID', 'OVERDUE'] }
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
        // GL entries have no reliable OPMC attribution. Never compare a scoped
        // subledger to the global control account or expose its balance.
        const arGlLines = scope === undefined ? await prisma.journalLine.findMany({
            where: {
                accountCode: ACCOUNTS.AR_CLIENT,
                entry: { status: { not: 'REVERSED' } }
            }
        }) : [];

        let glControlBalance = 0;
        for (const l of arGlLines) {
            glControlBalance += Number(l.debit) - Number(l.credit);
        }

        const isReconciled = scope === undefined && Math.abs(summary.total - glControlBalance) < 0.01;

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
    static async getApAgingReport(userId?: string | null): Promise<ApAgingReport> {
        const scope = await resolveOpmcScope(userId);
        const unpaidInvoices = await prisma.invoice.findMany({
            where: {
                ...(scope === undefined ? {} : { project: { opmcId: { in: scope } } }),
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
        const apGlLines = scope === undefined ? await prisma.journalLine.findMany({
            where: {
                accountCode: { in: [ACCOUNTS.AP_ACCRUED, ACCOUNTS.AP_VENDOR, ACCOUNTS.AP_CONTRACTOR] },
                entry: { status: { not: 'REVERSED' } }
            }
        }) : [];

        let glControlBalance = 0;
        for (const l of apGlLines) {
            glControlBalance += Number(l.credit) - Number(l.debit);
        }

        const isReconciled = scope === undefined && Math.abs(summary.total - glControlBalance) < 0.01;

        return {
            summary,
            glControlBalance,
            isReconciled,
            vendors: Array.from(vendorMap.values())
        };
    }
}
