import { prisma } from '@/lib/prisma';
import { InvoiceQueryService } from './invoice/invoice.query.service';
import { InvoiceGeneratorService } from './invoice/invoice.generator.service';
import { InvoiceCalculatorService } from './invoice/invoice.calculator.service';
import { InvoiceRetentionService } from './invoice/invoice.retention.service';

export class InvoiceService {

    /**
     * Generate Monthly Invoice for a Contractor
     */
    static async generateMonthlyInvoice(contractorId: string, month: number, year: number, userId: string) {
        // 1. Fetch eligible SODs
        const eligibleSods = await InvoiceQueryService.getEligibleSods(contractorId, month, year);
        if (eligibleSods.length === 0) {
            return { success: false, message: 'No eligible service orders found for this period.' };
        }

        // 2. Fetch Contractor Info
        const contractor = await prisma.contractor.findUnique({
            where: { id: contractorId }
        });
        if (!contractor) throw new Error('CONTRACTOR_NOT_FOUND');

        // 3. Prepare common variables
        const prefix = InvoiceCalculatorService.getContractorPrefix(contractor.name);
        const monthName = new Date(year, month - 1, 1).toLocaleString('default', { month: 'long' }).toUpperCase();
        const yearShort = year.toString().slice(-2);

        // 4. Group by Region and Generate
        const regions = InvoiceQueryService.groupByRegion(eligibleSods);
        const createdInvoices = [];

        for (const opmcId in regions) {
            const groupSods = regions[opmcId];
            const regionName = (groupSods[0].opmc.name.replace(/OPMC/i, '').trim() || 'REGION').toUpperCase();

            try {
                // Generate unique number
                const invoiceNumber = await InvoiceGeneratorService.generateUniqueNumber(
                    prefix, regionName, yearShort, monthName, contractor.name
                );

                // Calculate and Create
                const totalAmount = groupSods.reduce((sum, sod) => sum + (sod.contractorAmount || 0), 0);
                if (totalAmount === 0) continue;

                const invoice = await InvoiceGeneratorService.createRegionalInvoice({
                    invoiceNumber,
                    contractorId,
                    year,
                    month,
                    totalAmount,
                    regionName,
                    sodIds: groupSods.map(s => s.id)
                });

                createdInvoices.push(invoice);
            } catch (error) {
                console.error(`[INV-SERVICE] Failed for region ${regionName}:`, error);
            }
        }

        return {
            success: createdInvoices.length > 0,
            message: `Generated ${createdInvoices.length} invoices.`,
            invoices: createdInvoices
        };
    }

    /**
     * Check Logic for Part B (Retention) Release
     */
    static async checkRetentionEligibility() {
        return await InvoiceRetentionService.processAutoReleases();
    }
}
