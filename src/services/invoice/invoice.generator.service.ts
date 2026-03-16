import { prisma } from '@/lib/prisma';
import { InvoiceCalculatorService } from './invoice.calculator.service';

export class InvoiceGeneratorService {
    
    /**
     * Generate a unique invoice number with collision protection
     */
    static async generateUniqueNumber(
        basePrefix: string, 
        regionName: string, 
        yearShort: string, 
        monthName: string, 
        contractorName: string
    ): Promise<string> {
        const sequence = '001';
        const nameClean = contractorName.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
        let currentPrefix = basePrefix;
        let checks = 0;

        while (checks < 10) {
            // Format: [Prefix]/[Region]/NC/[YY]/[MONTH]/-[SEQ]A
            const invoiceNumber = `${currentPrefix}/${regionName}/NC/${yearShort}/${monthName}/-${sequence}A`;
            
            const existing = await prisma.invoice.count({ where: { invoiceNumber } });
            if (existing === 0) return invoiceNumber;

            // Collision: Append characters from name
            const nextChar = nameClean[checks] || String.fromCharCode(65 + checks);
            currentPrefix = basePrefix + nextChar;
            checks++;
        }

        throw new Error(`COULD_NOT_GENERATE_UNIQUE_INVOICE_NUMBER_FOR_${regionName}`);
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
                } as any
            });

            await tx.serviceOrder.updateMany({
                where: { id: { in: other.sodIds } },
                data: { invoiced: true, invoiceId: invoice.id }
            });

            return invoice;
        });
    }
}
