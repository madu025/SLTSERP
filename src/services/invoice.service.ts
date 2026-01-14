import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

export class InvoiceService {

    /**
     * Generate Monthly Invoice for a Contractor
     * Splits payment into Part A (90%) and Part B (10% Retention)
     */
    static async generateMonthlyInvoice(contractorId: string, month: number, year: number, userId: string) {
        // 1. Find eligible Service Orders
        // Criteria: 
        // - Assigned to this contractor
        // - SLTS Status is COMPLETED
        // - SLTS PAT Status is PASS (User requirement: "SLTS PAT pass")
        // - Completed in the given month/year
        // - Not yet invoiced

        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 0); // Last day of month

        const eligibleSods = await prisma.serviceOrder.findMany({
            where: {
                contractorId: contractorId,
                sltsStatus: 'COMPLETED',
                // Assuming sltsPatStatus='PASS' covers the user requirement. 
                // Sometimes 'sltsStatus' COMPLETED implies internal checks are done, but user insisted on "SLTS PAT pass".
                // Let's broaden check to be safe: opmcPatStatus or sltsPatStatus? 
                // User said "SLTS PAT pass". Let's assume sltsPatStatus is the field.
                sltsPatStatus: 'PASS',
                completedDate: {
                    gte: startDate,
                    lte: endDate
                },
                invoiced: false
            }
        });

        if (eligibleSods.length === 0) {
            return { success: false, message: 'No eligible service orders found for this period.' };
        }

        // 2. Fetch Contractor & Calculate Invoice Number
        const contractor = await prisma.contractor.findUnique({
            where: { id: contractorId },
            include: { opmc: true }
        });
        if (!contractor) throw new Error('Contractor not found');

        // Prefix: 2 words -> First letters (RT), 1 word -> First 3 letters
        const nameParts = contractor.name.trim().split(/\s+/);
        let prefix = '';
        if (nameParts.length >= 2) {
            prefix = (nameParts[0][0] + nameParts[1][0]).toUpperCase();
        } else {
            prefix = contractor.name.substring(0, 3).toUpperCase();
        }

        // Region (Default 'Metro' if missing)
        const region = contractor.opmc?.region || 'Metro';

        // Month Name (UPPERCASE) & Year
        const monthName = new Date(year, month - 1, 1).toLocaleString('default', { month: 'long' }).toUpperCase();
        const yearShort = year.toString().slice(-2);

        // Sequence: Extract from Contractor Registration Number
        // Format: SLTS-OSP-YYYY-YYYY-SEQ (e.g., SLTS-OSP-2025-2026-0001) -> 0001
        let sequence = '0000';
        if (contractor.registrationNumber) {
            const parts = contractor.registrationNumber.trim().split('-');
            if (parts.length > 0) {
                sequence = parts[parts.length - 1];
            }
        }

        // Construct Invoice Number (Base with 'A' suffix as per user request)
        // Format: [Prefix]/[Region]/NC/[YY]/[MONTH]/-[SEQ]A
        // Example: RC/Metro/NC/25/JULY/-0001A
        const invoiceNumber = `${prefix}/${region}/NC/${yearShort}/${monthName}/-${sequence}A`;

        // 3. Calculate Total Amount
        let totalAmount = 0;
        const validSodIds: string[] = [];

        for (const sod of eligibleSods) {
            // Ensure amount is valid (Assumed calculated at completion)
            const amount = sod.contractorAmount || 0;
            totalAmount += amount;
            validSodIds.push(sod.id);
        }

        if (totalAmount === 0) {
            return { success: false, message: 'Total calculated amount is 0. Please check Rate Cards or SOD amounts.' };
        }

        // 4. Split Amounts (90/10)
        const amountA = totalAmount * 0.90;
        const amountB = totalAmount * 0.10;

        // 5. Create Invoice

        const invoice = await prisma.$transaction(async (tx) => {
            // Create Invoice Record
            const newInvoice = await tx.invoice.create({
                data: {
                    invoiceNumber,
                    contractorId,
                    year,
                    month,
                    totalAmount,
                    amount, // Legacy field support

                    // 90% Immediate
                    amountA,
                    statusA: 'PENDING',

                    // 10% Retention
                    amountB,
                    statusB: 'HOLD', // Held for 6 months + HO PAT

                    status: 'PENDING', // Overall
                    description: `Monthly Invoice for ${month}/${year}. Includes ${validSodIds.length} SODs.`,

                    // Link SODs
                    sods: {
                        connect: validSodIds.map(id => ({ id }))
                    }
                }
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

        return { success: true, invoice };
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
            },
            include: {
                sods: {
                    select: { hoPatStatus: true, soNum: true }
                }
            }
        });

        const results = [];

        for (const invoice of holdInvoices) {
            // Check if ALL SODs have HO PAT = PASS
            // User: "masa 6 thulath approved wela nathhtm B kotasa Hold wenwa"
            // Means if ANY is not passed, it stays HOLD? Or we pay partial?
            // "Ema invoice ekata adala PAT SLT head offce eken avvroved wela thiyenna one" implies ALL must be approved for the Invoice B part release.
            // Or maybe we split? Assuming ALL for the Invoice unit.

            const allPassed = invoice.sods.every(sod => sod.hoPatStatus === 'PASS');
            // Check for Rejections?
            const anyRejected = invoice.sods.some(sod => sod.hoPatStatus === 'REJECTED');

            if (allPassed) {
                // Release Part B
                await prisma.invoice.update({
                    where: { id: invoice.id },
                    data: { statusB: 'ELIGIBLE' }
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
