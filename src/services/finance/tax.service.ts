import { prisma } from '@/lib/prisma';
import { LedgerService } from './ledger.service';
import { AppError } from '@/lib/error';
import { TransactionClient } from '../inventory/types';

export interface InvoiceTaxPostingPayload {
    invoiceId: string;
    invoiceNumber: string;
    netAmount: number;
    vatAmount: number;
    ssclAmount: number;
    whtAmount?: number;
    description?: string;
    postingDate?: Date;
    createdById?: string;
}

export interface VatReturnItem {
    id: string;
    date: string;
    referenceType: string | null;
    referenceId: string | null;
    description: string;
    outputVat: number;
    inputVat: number;
}

export interface VatReturnReport {
    fromDate?: string;
    toDate?: string;
    outputVatTotal: number;
    inputVatTotal: number;
    netVatPayable: number;
    lineItems: VatReturnItem[];
}

export interface WhtCertificateItem {
    id: string;
    date: string;
    referenceType: string | null;
    referenceId: string | null;
    vendorOrCustomer: string;
    grossAmount: number;
    whtRatePct: number;
    whtAmount: number;
}

export interface WhtRegisterReport {
    fromDate?: string;
    toDate?: string;
    totalWithheld: number;
    certificates: WhtCertificateItem[];
}

export class TaxService {
    /**
     * Log double-entry transaction for Invoice issuance including Output VAT & SSCL tax liabilities.
     * DR: Accounts Receivable (AR-1110) -> Net + VAT + SSCL
     * CR: Revenue (REV-4010) -> Net Amount
     * CR: Output VAT Payable (VAT-PAY-2110) -> VAT Amount
     * CR: SSCL Payable (SSCL-PAY-2115) -> SSCL Amount
     */
    static async logInvoiceTaxPosting(tx: TransactionClient, payload: InvoiceTaxPostingPayload) {
        const { netAmount, vatAmount, ssclAmount, invoiceId, invoiceNumber, createdById, postingDate } = payload;
        const grossAmount = netAmount + vatAmount + ssclAmount;

        if (grossAmount <= 0) {
            throw AppError.badRequest('Invoice posting total amount must be positive');
        }

        const lines = [
            {
                accountCode: 'AR-1110',
                debit: grossAmount,
                credit: 0,
                description: `Client AR for Invoice #${invoiceNumber}`
            },
            {
                accountCode: 'REV-4010',
                debit: 0,
                credit: netAmount,
                description: `Recognized Revenue for Invoice #${invoiceNumber}`
            }
        ];

        if (vatAmount > 0) {
            lines.push({
                accountCode: 'VAT-PAY-2110',
                debit: 0,
                credit: vatAmount,
                description: `Output VAT (18%) for Invoice #${invoiceNumber}`
            });
        }

        if (ssclAmount > 0) {
            lines.push({
                accountCode: 'SSCL-PAY-2115',
                debit: 0,
                credit: ssclAmount,
                description: `SSCL Payable (2.5%) for Invoice #${invoiceNumber}`
            });
        }

        return await LedgerService.postTransaction(tx, {
            referenceId: invoiceId,
            referenceType: 'INVOICE_TAX_ISSUANCE',
            description: payload.description || `Statutory Tax Entry for Issued Invoice #${invoiceNumber}`,
            date: postingDate,
            createdById,
            lines
        });
    }

    /**
     * Compute VAT Return (Output VAT vs Input VAT) for a given tax period.
     */
    static async getVatReturn(fromDate?: Date, toDate?: Date): Promise<VatReturnReport> {
        const dateFilter: any = {};
        if (fromDate) dateFilter.gte = fromDate;
        if (toDate) dateFilter.lte = toDate;

        const entryWhere = {
            status: { not: 'REVERSED' },
            ...(Object.keys(dateFilter).length > 0 && { date: dateFilter })
        };

        // Query Output VAT payable account (VAT-PAY-2110)
        const vatLines = await prisma.journalLine.findMany({
            where: {
                accountCode: 'VAT-PAY-2110',
                entry: entryWhere
            },
            include: {
                entry: true
            },
            orderBy: {
                entry: { date: 'asc' }
            }
        });

        let outputVatTotal = 0;
        let inputVatTotal = 0;
        const lineItems: VatReturnItem[] = [];

        for (const line of vatLines) {
            const outputVat = Number(line.credit);
            const inputVat = Number(line.debit);

            outputVatTotal += outputVat;
            inputVatTotal += inputVat;

            lineItems.push({
                id: line.id,
                date: line.entry.date.toISOString(),
                referenceType: line.entry.referenceType,
                referenceId: line.entry.referenceId,
                description: line.description || line.entry.description,
                outputVat,
                inputVat
            });
        }

        const netVatPayable = outputVatTotal - inputVatTotal;

        return {
            fromDate: fromDate?.toISOString(),
            toDate: toDate?.toISOString(),
            outputVatTotal,
            inputVatTotal,
            netVatPayable,
            lineItems
        };
    }

    /**
     * Get Withholding Tax (WHT) withholding register.
     */
    static async getWhtRegister(fromDate?: Date, toDate?: Date): Promise<WhtRegisterReport> {
        const dateFilter: any = {};
        if (fromDate) dateFilter.gte = fromDate;
        if (toDate) dateFilter.lte = toDate;

        const entryWhere = {
            status: { not: 'REVERSED' },
            ...(Object.keys(dateFilter).length > 0 && { date: dateFilter })
        };

        const whtLines = await prisma.journalLine.findMany({
            where: {
                accountCode: { in: ['WHT-PAY-2120', 'WHT-REC-1300'] },
                entry: entryWhere
            },
            include: {
                entry: true
            },
            orderBy: {
                entry: { date: 'asc' }
            }
        });

        let totalWithheld = 0;
        const certificates: WhtCertificateItem[] = [];

        for (const line of whtLines) {
            const amount = Number(line.credit) > 0 ? Number(line.credit) : Number(line.debit);
            totalWithheld += amount;

            certificates.push({
                id: line.id,
                date: line.entry.date.toISOString(),
                referenceType: line.entry.referenceType,
                referenceId: line.entry.referenceId,
                vendorOrCustomer: line.description || 'Vendor / Contractor',
                grossAmount: amount / 0.05, // 5% standard WHT rate gross derivation
                whtRatePct: 5,
                whtAmount: amount
            });
        }

        return {
            fromDate: fromDate?.toISOString(),
            toDate: toDate?.toISOString(),
            totalWithheld,
            certificates
        };
    }
}
