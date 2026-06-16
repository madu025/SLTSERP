import { prisma } from '@/lib/prisma';
import { InvoiceQueryService } from './invoice/invoice.query.service';
import { InvoiceGeneratorService } from './invoice/invoice.generator.service';
import { InvoiceCalculatorService } from './invoice/invoice.calculator.service';
import { InvoiceRetentionService } from './invoice/invoice.retention.service';

export class InvoiceService {

    /**
     * Generate Monthly Invoice for a Contractor
     */
    static async generateMonthlyInvoice(contractorId: string, month: number, year: number) {
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

        // 4. Group by Region and Generate
        const regions = InvoiceQueryService.groupByRegion(eligibleSods);
        const createdInvoices = [];

        for (const opmcId in regions) {
            const groupSods = regions[opmcId];
            const regionName = (groupSods[0].opmc.name.replace(/OPMC/i, '').trim() || 'REGION').toUpperCase();

            try {
                // Generate unique number: INV/[PREFIX]/[REG]/[YY]/[MM]-[SEQ]
                const invoiceNumber = await InvoiceGeneratorService.generateUniqueNumber(
                    prefix, regionName, year, month
                );

                // Calculate and Create
                const totalAmount = groupSods.reduce((sum, sod) => sum + (sod.contractorAmount || 0), 0);
                if (totalAmount === 0) continue;

                // Audit each SOD for penalties
                const penaltiesList: { amount: number; reason: string; description?: string; serviceOrderId?: string }[] = [];
                let penaltyTotal = 0;

                for (const sod of groupSods) {
                    // 1. QC Officer Quality Check Failure (opmcPatStatus === 'REJECTED')
                    if (sod.opmcPatStatus === 'REJECTED') {
                        const amt = 1500;
                        penaltiesList.push({
                            amount: amt,
                            reason: 'QC_FAILURE',
                            description: 'QC Quality Check Failure (OPMC PAT Rejected)',
                            serviceOrderId: sod.id
                        });
                        penaltyTotal += amt;
                    }

                    // 2. SLT PAT Reject (sltsPatStatus === 'REJECTED')
                    if (sod.sltsPatStatus === 'REJECTED') {
                        const amt = 2500;
                        penaltiesList.push({
                            amount: amt,
                            reason: 'PAT_REJECT',
                            description: 'SLT PAT Rejected',
                            serviceOrderId: sod.id
                        });
                        penaltyTotal += amt;
                    }

                    // 3. Material Mismatch
                    let materialMismatch = false;
                    let mismatchReason = '';

                    const dropWireDistance = sod.dropWireDistance || 0;
                    if (dropWireDistance > 0) {
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        const hasDropwireMaterial = (sod as any).materialUsage?.some((mu: any) => {
                            const code = mu.item?.code || '';
                            const name = mu.item?.name || '';
                            return code.toUpperCase().includes('F-1') || 
                                   code.toUpperCase().includes('G-1') || 
                                   name.toUpperCase().includes('F-1') || 
                                   name.toUpperCase().includes('G-1');
                        });
                        if (!hasDropwireMaterial) {
                            materialMismatch = true;
                            mismatchReason = `Recorded drop-wire distance of ${dropWireDistance}m but no F-1/G-1 material logged.`;
                        }
                    }

                    const isNewConnection = sod.orderType?.toUpperCase().includes('NEW') || 
                                            sod.serviceType?.toUpperCase().includes('NEW');
                    if (isNewConnection && sod.ontType === 'NEW') {
                        if (!sod.ontSerialNumber || sod.ontSerialNumber.trim() === '') {
                            materialMismatch = true;
                            mismatchReason = mismatchReason 
                                ? `${mismatchReason} Also, missing ONT Router Serial Number for a new connection.`
                                : 'Missing ONT Router Serial Number for a new connection.';
                        }
                    }

                    if (materialMismatch) {
                        const amt = 1000;
                        penaltiesList.push({
                            amount: amt,
                            reason: 'MATERIAL_MISMATCH',
                            description: mismatchReason,
                            serviceOrderId: sod.id
                        });
                        penaltyTotal += amt;
                    }
                }

                const invoice = await InvoiceGeneratorService.createRegionalInvoice({
                    invoiceNumber,
                    contractorId,
                    year,
                    month,
                    totalAmount,
                    regionName,
                    sodIds: groupSods.map(s => s.id),
                    penaltyTotal,
                    penaltiesList
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
