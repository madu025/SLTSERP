import { prisma } from '@/lib/prisma';
import { LedgerService } from './ledger.service';
import { ACCOUNTS } from './account-codes';
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
        const { invoiceId, invoiceNumber, netAmount, vatAmount, ssclAmount, description, postingDate, createdById } = payload;
        const totalAr = netAmount + vatAmount + ssclAmount;

        const lines: { accountCode: string; debit: number; credit: number; description: string }[] = [
            {
                accountCode: ACCOUNTS.AR_CLIENT,
                debit: totalAr,
                credit: 0,
                description: `Accounts Receivable for Invoice ${invoiceNumber} (incl. Tax)`
            },
            {
                accountCode: ACCOUNTS.REVENUE,
                debit: 0,
                credit: netAmount,
                description: `Net Revenue for Invoice ${invoiceNumber}`
            }
        ];

        if (vatAmount > 0) {
            lines.push({
                accountCode: ACCOUNTS.VAT_PAYABLE,
                debit: 0,
                credit: vatAmount,
                description: `Output VAT 18% for Invoice ${invoiceNumber}`
            });
        }

        if (ssclAmount > 0) {
            lines.push({
                accountCode: ACCOUNTS.SSCL_PAYABLE,
                debit: 0,
                credit: ssclAmount,
                description: `SSCL 2.5% for Invoice ${invoiceNumber}`
            });
        }

        return await LedgerService.postTransaction(tx, {
            referenceId: invoiceId,
            referenceType: 'INVOICE_TAX_POSTING',
            description: description || `Tax Breakdown Posting for Invoice ${invoiceNumber}`,
            date: postingDate || new Date(),
            createdById,
            lines
        });
    }

    /**
     * Calculate output VAT, input VAT, and net VAT payable for a target date period.
     */
    static async getVatReturnReport(fromDate?: Date, toDate?: Date): Promise<VatReturnReport> {
        const dateFilter: Record<string, unknown> = {};
        if (fromDate) dateFilter.gte = fromDate;
        if (toDate) dateFilter.lte = toDate;

        const entryWhere = {
            status: { not: 'REVERSED' },
            ...(Object.keys(dateFilter).length > 0 && { date: dateFilter })
        };

        const vatLines = await prisma.journalLine.findMany({
            where: {
                accountCode: ACCOUNTS.VAT_PAYABLE,
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
            const outputVal = Number(line.credit);
            const inputVal = Number(line.debit);

            outputVatTotal += outputVal;
            inputVatTotal += inputVal;

            lineItems.push({
                id: line.id,
                date: line.entry.date.toISOString(),
                referenceType: line.entry.referenceType,
                referenceId: line.entry.referenceId,
                description: line.description || line.entry.description,
                outputVat: outputVal,
                inputVat: inputVal
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
     * Retrieve WHT Certificate Register for tax compliance and IRD reporting.
     * Dynamically reads FINANCE_WHT_PERCENT from SystemConfig.
     */
    static async getWhtRegister(fromDate?: Date, toDate?: Date): Promise<WhtRegisterReport> {
        const dateFilter: Record<string, unknown> = {};
        if (fromDate) dateFilter.gte = fromDate;
        if (toDate) dateFilter.lte = toDate;

        // Dynamically load WHT percent from SystemConfig (defaults to 5% if unconfigured)
        let whtRatePct = 5;
        const whtConfig = await prisma.systemConfig.findUnique({ where: { key: 'FINANCE_WHT_PERCENT' } });
        if (whtConfig && whtConfig.value) {
            const parsed = parseFloat(whtConfig.value);
            if (!isNaN(parsed) && parsed > 0) whtRatePct = parsed;
        }
        const whtFraction = whtRatePct / 100;

        const entryWhere = {
            status: { not: 'REVERSED' },
            ...(Object.keys(dateFilter).length > 0 && { date: dateFilter })
        };

        const whtLines = await prisma.journalLine.findMany({
            where: {
                accountCode: { in: [ACCOUNTS.WHT_PAYABLE, ACCOUNTS.WHT_RECEIVABLE] },
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
                grossAmount: whtFraction > 0 ? amount / whtFraction : amount,
                whtRatePct,
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
