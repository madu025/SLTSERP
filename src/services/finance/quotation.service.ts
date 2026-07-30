import { prisma } from '@/lib/prisma';

interface QuoteItemInput {
    itemCode: string;
    description: string;
    unit?: string;
    quantity: number;
    unitPrice: number;
    deliveryDate?: string | Date | null;
    deliveryDays?: number | null;
    notes?: string | null;
}

interface CreateQuotationInput {
    requisitionId: string;
    vendorId: string;
    vendorName?: string;
    quoteDate?: string | Date;
    validUntil?: string | Date | null;
    currency?: string;
    deliveryDays?: number | null;
    warrantyPeriod?: string | number | null;
    paymentTerms?: string | null;
    remarks?: string | null;
    items: QuoteItemInput[];
}

export class QuotationService {
    /**
     * Get list of quotations for a requisition
     */
    static async getQuotations(requisitionId: string) {
        const quotations = await prisma.quotation.findMany({
            where: { requisitionId },
            include: {
                items: true,
                vendor: { select: { id: true, code: true, name: true } }
            },
            orderBy: { quoteDate: 'desc' },
        });
        return quotations;
    }

    /**
     * Create a new quotation with items in a transaction
     */
    static async createQuotation(data: CreateQuotationInput) {
        const {
            requisitionId,
            vendorId,
            vendorName,
            quoteDate,
            validUntil,
            currency,
            deliveryDays,
            warrantyPeriod,
            paymentTerms,
            remarks,
            items,
        } = data;

        // Auto-generate quote number
        const lastQuote = await prisma.quotation.findFirst({
            orderBy: { quoteNumber: 'desc' },
            select: { quoteNumber: true },
        });

        let nextQuoteNumber: string;
        if (lastQuote && lastQuote.quoteNumber) {
            const lastNum = parseInt(lastQuote.quoteNumber.replace('QTN-', ''), 10);
            const nextNum = isNaN(lastNum) ? 1 : lastNum + 1;
            nextQuoteNumber = 'QTN-' + String(nextNum).padStart(5, '0');
        } else {
            nextQuoteNumber = 'QTN-00001';
        }

        // Calculate total
        let totalAmount = 0;
        const itemsData = items.map((item) => {
            const totalPrice = (item.unitPrice || 0) * (item.quantity || 0);
            totalAmount += totalPrice;
            return {
                itemCode: item.itemCode,
                description: item.description,
                unit: item.unit || 'NOS',
                quantity: item.quantity || 0,
                unitPrice: item.unitPrice || 0,
                totalPrice,
                deliveryDays: item.deliveryDays || null,
                notes: item.notes || null,
            };
        });

        const quotation = await prisma.$transaction(async (tx) => {
            const newQuote = await tx.quotation.create({
                data: {
                    quoteNumber: nextQuoteNumber,
                    requisitionId,
                    vendorId,
                    vendorName: vendorName || '',
                    quoteDate: quoteDate ? new Date(quoteDate) : new Date(),
                    validUntil: validUntil ? new Date(validUntil) : null,
                    totalAmount,
                    currency: currency || 'LKR',
                    deliveryDays: deliveryDays || null,
                    warrantyPeriod: warrantyPeriod ? String(warrantyPeriod) : null,
                    paymentTerms: paymentTerms || null,
                    remarks: remarks || null,
                    items: { create: itemsData },
                },
                include: { items: true, vendor: true },
            });
            return newQuote;
        });

        return quotation;
    }

    /**
     * Update quotation status
     */
    static async updateQuotationStatus(id: string, status: string, acceptedById?: string | null) {
        const updateData: Record<string, unknown> = { status };
        if (status === 'ACCEPTED' && acceptedById) {
            updateData.acceptedById = acceptedById;
            updateData.acceptedAt = new Date();
        }

        const quotation = await prisma.quotation.update({
            where: { id },
            data: updateData,
            include: { items: true, vendor: true },
        });

        return quotation;
    }
}
