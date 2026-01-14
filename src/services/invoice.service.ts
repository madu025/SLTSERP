import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

export class InvoiceService {

    /**
     * Generate Monthly Invoice for a Contractor
     * Splits payment into Part A (90%) and Part B (10% Retention)
     * Groups by Region (OPMC) to create separate invoices per region
     */
    static async generateMonthlyInvoice(contractorId: string, month: number, year: number, userId: string) {
        // 1. Find eligible Service Orders
        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 0); // Last day of month

        const eligibleSods = await prisma.serviceOrder.findMany({
            where: {
                contractorId: contractorId,
                sltsStatus: 'COMPLETED',
                sltsPatStatus: 'PASS',
                completedDate: {
                    gte: startDate,
                    lte: endDate
                },
                invoiced: false
            },
            include: {
                opmc: true
            }
        });

        if (eligibleSods.length === 0) {
            return { success: false, message: 'No eligible service orders found for this period.' };
        }

        // 2. Fetch Contractor Details (Prefix & Sequence Source)
        const contractor = await prisma.contractor.findUnique({
            where: { id: contractorId },
            include: { opmc: true } // still fetch default for fallback, though we use SOD opmc primarily
        });
        if (!contractor) throw new Error('Contractor not found');

        // Prefix construction
        const nameParts = contractor.name.trim().split(/\s+/);
        let prefix = '';
        if (nameParts.length >= 2) {
            prefix = (nameParts[0][0] + nameParts[1][0]).toUpperCase();
        } else {
            prefix = contractor.name.substring(0, 3).toUpperCase();
        }

        // Sequence: Fixed to '001' as per user requirement
        // "aga kotasa sama invoice ekakama 001 wima must"
        const sequence = '001';

        const monthName = new Date(year, month - 1, 1).toLocaleString('default', { month: 'long' }).toUpperCase();
        const yearShort = year.toString().slice(-2);

        // 3. Group SODs by OPMC (Region)
        const sodsByOpmc: Record<string, typeof eligibleSods> = {};
        for (const sod of eligibleSods) {
            const opmcId = sod.opmcId;
            if (!sodsByOpmc[opmcId]) {
                sodsByOpmc[opmcId] = [];
            }
            sodsByOpmc[opmcId].push(sod);
        }

        const createdInvoices = [];

        // 4. Generate Invoice per Region
        for (const opmcId in sodsByOpmc) {
            const groupSods = sodsByOpmc[opmcId];
            if (groupSods.length === 0) continue;

            const cleanName = groupSods[0].opmc.name.replace(/OPMC/i, '').trim() || 'REGION';
            const regionName = cleanName.toUpperCase();

            // Generate Candidate Invoice Numbers
            // Strategy: Start with standard prefix. If collision, extend prefix with chars from name.

            const contractorNameClean = contractor.name.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
            let currentPrefix = prefix;

            let isUnique = false;
            let invoiceNumber = '';
            let checks = 0;

            while (!isUnique && checks < 10) {
                // Format: [Prefix]/[Region]/NC/[YY]/[MONTH]/-[SEQ]A
                // User requirement: Keep suffix 'A' constant. Modify Prefix.
                invoiceNumber = `${currentPrefix}/${regionName}/NC/${yearShort}/${monthName}/-${sequence}A`;

                const existing = await prisma.invoice.count({
                    where: { invoiceNumber }
                });

                if (existing === 0) {
                    isUnique = true;
                } else {
                    // Collision! Add a letter from the name to the prefix
                    // e.g. RT -> RTR -> RTA -> ...
                    const nextChar = contractorNameClean[checks] || String.fromCharCode(65 + checks);
                    currentPrefix = prefix + nextChar;
                    checks++;
                }
            }

            if (!isUnique) {
                console.error(`Failed to generate unique invoice number for ${regionName} after 10 attempts.`);
                continue;
            }

            // Calculate Totals
            let groupTotal = 0;
            const validSodIds: string[] = [];
            for (const sod of groupSods) {
                const amount = sod.contractorAmount || 0;
                groupTotal += amount;
                validSodIds.push(sod.id);
            }

            if (groupTotal === 0) continue;

            const amountA = groupTotal * 0.90;
            const amountB = groupTotal * 0.10;

            try {
                const invoice = await prisma.$transaction(async (tx) => {
                    // Create Invoice Record
                    const newInvoice = await tx.invoice.create({
                        data: {
                            invoiceNumber,
                            contractorId,
                            year,
                            month,
                            totalAmount: groupTotal,
                            amount: groupTotal, // Legacy
                            amountA,
                            statusA: 'PENDING',
                            amountB,
                            statusB: 'HOLD',
                            status: 'PENDING',
                            description: `Monthly Invoice for ${regionName} - ${month}/${year}`,
                            sods: {
                                connect: validSodIds.map(id => ({ id }))
                            }
                        } as any
                    });

                    // Mark SODs as Invoiced
                    await tx.serviceOrder.updateMany({
                        where: { id: { in: validSodIds } },
                        data: {
                            invoiced: true,
                            invoiceId: newInvoice.id
                        }
                    });

                    return newInvoice;
                });

                createdInvoices.push(invoice);

            } catch (error) {
                console.error(`Failed to create invoice for region ${regionName}:`, error);
                // Continue to next region
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
     * Should be run periodically or on demand
     */
    static async checkRetentionEligibility() {
        // Find invoices created > 6 months ago with statusB = 'HOLD'
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

        const holdInvoices = await prisma.invoice.findMany({
            where: {
                statusB: 'HOLD',
                createdAt: {
                    lte: sixMonthsAgo
                }
            } as any,
            include: {
                sods: {
                    select: { hoPatStatus: true, soNum: true }
                }
            } as any
        });

        const results = [];

        for (const invoice of holdInvoices) {
            const allPassed = (invoice as any).sods.every((sod: any) => sod.hoPatStatus === 'PASS');
            const anyRejected = (invoice as any).sods.some((sod: any) => sod.hoPatStatus === 'REJECTED');

            if (allPassed) {
                // Release Part B
                await prisma.invoice.update({
                    where: { id: invoice.id },
                    data: { statusB: 'ELIGIBLE' } as any
                });
                results.push({ invoice: invoice.invoiceNumber, status: 'RELEASED' });
            } else {
                // Keep Hold
                results.push({ invoice: invoice.invoiceNumber, status: 'STILL_HOLD', reason: anyRejected ? 'Has Rejections' : 'Pending Approvals' });
            }
        }

        return results;
    }
}
