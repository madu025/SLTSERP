import { prisma } from '@/lib/prisma';
import { AuditService } from '@/services/audit.service';
import { InvoiceCalculatorService } from '@/services/invoice/invoice.calculator.service';

export interface RateRuleDTO {
    id: string;
    workType: string;
    workDescription: string;
    minDistance: number;
    maxDistance: number;
    areaGroup: string;
    rateAmount: number;
    poleType?: string | null;
    poleMethod?: string | null;
    isActive: boolean;
}

export interface AmendmentRequestDTO {
    id: string;
    invoiceId: string;
    originalAmount: number;
    requestedAmount: number;
    originalAmountA: number;
    requestedAmountA: number;
    originalAmountB: number;
    requestedAmountB: number;
    reason: string;
    status: string;
    requestedById: string;
    approvedById?: string | null;
    approvedAt?: Date | null;
    rejectionReason?: string | null;
    createdAt: Date;
    invoice?: {
        id: string;
        invoiceNumber: string;
        totalAmount: number;
        contractor?: {
            name: string;
        } | null;
    } | null;
    requestedBy?: {
        name: string | null;
        email: string;
    } | null;
}

const DEFAULT_RATE_RULES = [
    // FTTH Brackets
    { workType: 'FTTH', workDescription: 'FTTH New Connection (0 - 100m)', minDistance: 0, maxDistance: 100, areaGroup: 'CEN', rateAmount: 6750 },
    { workType: 'FTTH', workDescription: 'FTTH New Connection (0 - 100m)', minDistance: 0, maxDistance: 100, areaGroup: 'HK', rateAmount: 6750 },
    { workType: 'FTTH', workDescription: 'FTTH New Connection (0 - 100m)', minDistance: 0, maxDistance: 100, areaGroup: 'OTHER', rateAmount: 6650 },

    { workType: 'FTTH', workDescription: 'FTTH New Connection (101 - 200m)', minDistance: 101, maxDistance: 200, areaGroup: 'CEN', rateAmount: 8250 },
    { workType: 'FTTH', workDescription: 'FTTH New Connection (101 - 200m)', minDistance: 101, maxDistance: 200, areaGroup: 'HK', rateAmount: 8250 },
    { workType: 'FTTH', workDescription: 'FTTH New Connection (101 - 200m)', minDistance: 101, maxDistance: 200, areaGroup: 'OTHER', rateAmount: 8150 },

    { workType: 'FTTH', workDescription: 'FTTH New Connection (201 - 300m)', minDistance: 201, maxDistance: 300, areaGroup: 'CEN', rateAmount: 9750 },
    { workType: 'FTTH', workDescription: 'FTTH New Connection (201 - 300m)', minDistance: 201, maxDistance: 300, areaGroup: 'HK', rateAmount: 9750 },
    { workType: 'FTTH', workDescription: 'FTTH New Connection (201 - 300m)', minDistance: 201, maxDistance: 300, areaGroup: 'OTHER', rateAmount: 9650 },

    { workType: 'FTTH', workDescription: 'FTTH New Connection (301 - 400m)', minDistance: 301, maxDistance: 400, areaGroup: 'CEN', rateAmount: 11250 },
    { workType: 'FTTH', workDescription: 'FTTH New Connection (301 - 400m)', minDistance: 301, maxDistance: 400, areaGroup: 'HK', rateAmount: 11250 },
    { workType: 'FTTH', workDescription: 'FTTH New Connection (301 - 400m)', minDistance: 301, maxDistance: 400, areaGroup: 'OTHER', rateAmount: 11150 },

    { workType: 'FTTH', workDescription: 'FTTH New Connection (401 - 500m)', minDistance: 401, maxDistance: 500, areaGroup: 'CEN', rateAmount: 12750 },
    { workType: 'FTTH', workDescription: 'FTTH New Connection (401 - 500m)', minDistance: 401, maxDistance: 500, areaGroup: 'HK', rateAmount: 12750 },
    { workType: 'FTTH', workDescription: 'FTTH New Connection (401 - 500m)', minDistance: 401, maxDistance: 500, areaGroup: 'OTHER', rateAmount: 12650 },

    { workType: 'FTTH', workDescription: 'FTTH New Connection (501m+)', minDistance: 501, maxDistance: 99999, areaGroup: 'CEN', rateAmount: 14250 },
    { workType: 'FTTH', workDescription: 'FTTH New Connection (501m+)', minDistance: 501, maxDistance: 99999, areaGroup: 'HK', rateAmount: 14250 },
    { workType: 'FTTH', workDescription: 'FTTH New Connection (501m+)', minDistance: 501, maxDistance: 99999, areaGroup: 'OTHER', rateAmount: 14150 },

    // Pole Installation
    { workType: 'POLE', workDescription: 'Pole Installation (5.6m Standard)', minDistance: 0, maxDistance: 0, areaGroup: 'CEN', rateAmount: 700, poleType: '5.6m', poleMethod: 'STANDARD' },
    { workType: 'POLE', workDescription: 'Pole Installation (5.6m Standard)', minDistance: 0, maxDistance: 0, areaGroup: 'HK', rateAmount: 700, poleType: '5.6m', poleMethod: 'STANDARD' },
    { workType: 'POLE', workDescription: 'Pole Installation (5.6m Standard)', minDistance: 0, maxDistance: 0, areaGroup: 'OTHER', rateAmount: 700, poleType: '5.6m', poleMethod: 'STANDARD' }
];

export class PricingAuditService {
    /**
     * Fetch all rate rules from database. Auto-seeds default matrix if table is empty.
     */
    static async getRateRules(): Promise<{ count: number; rules: RateRuleDTO[] }> {
        let count = await prisma.contractorRateRule.count();
        if (count === 0) {
            await prisma.contractorRateRule.createMany({
                data: DEFAULT_RATE_RULES
            });
        }

        const rules = await prisma.contractorRateRule.findMany({
            orderBy: [{ workType: 'asc' }, { minDistance: 'asc' }, { areaGroup: 'asc' }],
            select: {
                id: true,
                workType: true,
                workDescription: true,
                minDistance: true,
                maxDistance: true,
                areaGroup: true,
                rateAmount: true,
                poleType: true,
                poleMethod: true,
                isActive: true
            }
        });

        return { count: rules.length, rules };
    }

    /**
     * Update rate amount for a specific rate rule by ID
     */
    static async updateRateRule(id: string, rateAmount: number): Promise<RateRuleDTO> {
        const updated = await prisma.contractorRateRule.update({
            where: { id },
            data: { rateAmount },
            select: {
                id: true,
                workType: true,
                workDescription: true,
                minDistance: true,
                maxDistance: true,
                areaGroup: true,
                rateAmount: true,
                poleType: true,
                poleMethod: true,
                isActive: true
            }
        });

        return updated;
    }

    /**
     * Retrieve all pending invoice amendment requests for SF Audit review
     */
    static async getPendingAmendmentRequests(): Promise<{ count: number; requests: AmendmentRequestDTO[] }> {
        const requests = await prisma.invoiceAmendmentRequest.findMany({
            where: { status: 'PENDING_SF_APPROVAL' },
            select: {
                id: true,
                invoiceId: true,
                originalAmount: true,
                requestedAmount: true,
                originalAmountA: true,
                requestedAmountA: true,
                originalAmountB: true,
                requestedAmountB: true,
                reason: true,
                status: true,
                requestedById: true,
                approvedById: true,
                approvedAt: true,
                rejectionReason: true,
                createdAt: true,
                invoice: {
                    select: {
                        id: true,
                        invoiceNumber: true,
                        totalAmount: true,
                        contractor: { select: { name: true } }
                    }
                },
                requestedBy: {
                    select: { name: true, email: true }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        return { count: requests.length, requests };
    }

    /**
     * Create new invoice amendment request
     */
    static async createAmendmentRequest(invoiceId: string, requestedAmount: number, reason: string, userId: string) {
        const invoice = await prisma.invoice.findUnique({
            where: { id: invoiceId },
            select: { id: true, totalAmount: true, amountA: true, amountB: true }
        });

        if (!invoice) {
            throw new Error('Invoice not found');
        }

        const split = InvoiceCalculatorService.calculateSplit(requestedAmount);

        const amendmentRequest = await prisma.invoiceAmendmentRequest.create({
            data: {
                invoiceId,
                originalAmount: parseFloat(invoice.totalAmount.toString()),
                requestedAmount,
                originalAmountA: parseFloat(invoice.amountA.toString()),
                requestedAmountA: split.amountA,
                originalAmountB: parseFloat(invoice.amountB.toString()),
                requestedAmountB: split.amountB,
                reason,
                status: 'PENDING_SF_APPROVAL',
                requestedById: userId
            }
        });

        return amendmentRequest;
    }

    /**
     * Approve or reject an amendment request
     */
    static async processAmendmentRequest(requestId: string, status: 'APPROVED' | 'REJECTED', userId: string, rejectionReason?: string) {
        const amendmentRequest = await prisma.invoiceAmendmentRequest.findUnique({
            where: { id: requestId },
            include: { invoice: true, requestedBy: { select: { name: true, email: true } } }
        });

        if (!amendmentRequest) {
            throw new Error('Amendment Request not found');
        }

        if (amendmentRequest.status !== 'PENDING_SF_APPROVAL') {
            throw new Error(`Request already processed with status ${amendmentRequest.status}`);
        }

        if (status === 'REJECTED') {
            const rejected = await prisma.invoiceAmendmentRequest.update({
                where: { id: requestId },
                data: {
                    status: 'REJECTED',
                    approvedById: userId,
                    approvedAt: new Date(),
                    rejectionReason: rejectionReason || 'Rejected by SF Audit Manager'
                }
            });
            return { status: 'REJECTED' as const, amendmentRequest: rejected, invoice: null };
        }

        // Approve logic
        const result = await prisma.$transaction(async (tx) => {
            const approvedReq = await tx.invoiceAmendmentRequest.update({
                where: { id: requestId },
                data: {
                    status: 'APPROVED',
                    approvedById: userId,
                    approvedAt: new Date()
                }
            });

            const updatedInvoice = await tx.invoice.update({
                where: { id: amendmentRequest.invoiceId },
                data: {
                    totalAmount: amendmentRequest.requestedAmount,
                    amountA: amendmentRequest.requestedAmountA,
                    amountB: amendmentRequest.requestedAmountB
                }
            });

            await AuditService.log({
                userId,
                action: 'INVOICE_AMOUNT_AMENDMENT',
                entity: 'Invoice',
                entityId: amendmentRequest.invoiceId,
                newValue: {
                    originalAmount: amendmentRequest.originalAmount,
                    newAmount: amendmentRequest.requestedAmount,
                    reason: amendmentRequest.reason,
                    requestedBy: amendmentRequest.requestedBy?.name || amendmentRequest.requestedById,
                    approvedBy: userId
                }
            });

            return { approvedReq, updatedInvoice };
        });

        return { status: 'APPROVED' as const, amendmentRequest: result.approvedReq, invoice: result.updatedInvoice };
    }
}
