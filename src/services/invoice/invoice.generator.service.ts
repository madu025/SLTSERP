import { prisma } from '@/lib/prisma';
import { InvoiceCalculatorService } from './invoice.calculator.service';

export class InvoiceGeneratorService {
    
    /**
     * Generate a unique invoice number using sequential logic
     * Format: INV/[PREFIX]/[REGION]/[YY]/[MM]-[SEQ]
     * Example: INV/COL/24/03-001
     */
    static async generateUniqueNumber(
        contractorPrefix: string,
        regionName: string,
        year: number,
        month: number
    ): Promise<string> {
        const yearShort = year.toString().slice(-2);
        const monthPad = month.toString().padStart(2, '0');
        const regClean = regionName.toUpperCase().replace(/[^A-Z0-9]/g, '');
        
        const pattern = `INV/${contractorPrefix}/${regClean}/${yearShort}/${monthPad}-`;
        
        // Find the latest invoice number with this pattern to increment sequence
        const latestInvoice = await prisma.invoice.findFirst({
            where: { invoiceNumber: { startsWith: pattern } },
            orderBy: { invoiceNumber: 'desc' },
            select: { invoiceNumber: true }
        });

        let nextSeq = 1;
        if (latestInvoice) {
            const parts = latestInvoice.invoiceNumber.split('-');
            const lastSeq = parseInt(parts[parts.length - 1]);
            if (!isNaN(lastSeq)) {
                nextSeq = lastSeq + 1;
            }
        }

        return `${pattern}${nextSeq.toString().padStart(3, '0')}`;
    }

    /**
     * Create actual invoice record and connect SODs in a transaction
     */
    static async createRegionalInvoice(data: {
        invoiceNumber: string;
        contractorId: string;
        year: number;
        month: number;
        totalAmount: number;
        regionName: string;
        sodIds: string[];
    }) {
        const { totalAmount, ...other } = data;
        const { amountA, amountB } = InvoiceCalculatorService.calculateSplit(totalAmount);

        return await prisma.$transaction(async (tx) => {
            const invoice = await tx.invoice.create({
                data: {
                    invoiceNumber: other.invoiceNumber,
                    contractorId: other.contractorId,
                    year: other.year,
                    month: other.month,
                    totalAmount: totalAmount,
                    amount: totalAmount,
                    amountA,
                    statusA: 'PENDING',
                    amountB,
                    statusB: 'HOLD',
                    status: 'PENDING',
                    description: `Monthly Invoice for ${other.regionName} - ${other.month}/${other.year}`,
                    sods: { connect: other.sodIds.map(id => ({ id })) }
                }
            });

            await tx.serviceOrder.updateMany({
                where: { id: { in: other.sodIds } },
                data: { invoiced: true, invoiceId: invoice.id }
            });

            return invoice;
        });
    }
}
