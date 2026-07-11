import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { InvoiceQueryService } from './invoice/invoice.query.service';
import { InvoiceGeneratorService } from './invoice/invoice.generator.service';
import { InvoiceCalculatorService } from './invoice/invoice.calculator.service';
import { InvoiceRetentionService } from './invoice/invoice.retention.service';
import { CreateInvoiceDTO, UpdateInvoiceDTO } from '@/lib/validations/invoice.schema';
import { AppError, ErrorCode } from '@/lib/error';

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
                            const code = (mu.item?.code || '').toUpperCase();
                            const name = (mu.item?.name || '').toUpperCase();
                            return code.includes('F-1') || 
                                   code.includes('G-1') || 
                                   code.includes('F1') || 
                                   code.includes('G1') || 
                                   code.includes('DW') || 
                                   name.includes('F-1') || 
                                   name.includes('G-1') || 
                                   name.includes('F1') || 
                                   name.includes('G1') || 
                                   name.includes('DROP WIRE') || 
                                   name.includes('DROPWIRE') || 
                                   name.includes('DW');
                        });
                        if (!hasDropwireMaterial) {
                            materialMismatch = true;
                            mismatchReason = `Recorded drop-wire distance of ${dropWireDistance}m but no drop-wire material logged.`;
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

    /**
     * Get list of contractor invoices with filters
     */
    static async getInvoices(filters: { status?: string; contractorId?: string; projectId?: string }) {
        const where: Prisma.InvoiceWhereInput = {};
        if (filters.status) where.status = filters.status;
        if (filters.contractorId) where.contractorId = filters.contractorId;
        if (filters.projectId) where.projectId = filters.projectId;

        return await prisma.invoice.findMany({
            where,
            include: {
                contractor: {
                    select: {
                        id: true,
                        name: true,
                        contactNumber: true,
                        address: true,
                        registrationNumber: true,
                        bankName: true,
                        bankBranch: true,
                        bankAccountNumber: true
                    }
                },
                project: {
                    select: {
                        id: true,
                        name: true
                    }
                },
                _count: {
                    select: {
                        sods: true
                    }
                }
            },
            orderBy: {
                createdAt: 'desc'
            }
        });
    }

    /**
     * Create a manual invoice
     */
    static async createInvoice(data: CreateInvoiceDTO) {
        // Check if invoice number already exists
        const existing = await prisma.invoice.findUnique({
            where: { invoiceNumber: data.invoiceNumber }
        });

        if (existing) {
            throw new AppError('Invoice number already exists', ErrorCode.CONFLICT, 400);
        }

        return await prisma.invoice.create({
            data: {
                invoiceNumber: data.invoiceNumber,
                contractorId: data.contractorId,
                projectId: data.projectId || null,
                amount: typeof data.amount === 'string' ? parseFloat(data.amount) : data.amount,
                status: 'PENDING',
                date: new Date(),
                description: data.description || null,
                dueDate: data.dueDate ? new Date(data.dueDate) : null
            },
            include: {
                contractor: {
                    select: {
                        id: true,
                        name: true,
                        contactNumber: true
                    }
                },
                project: {
                    select: {
                        id: true,
                        name: true
                    }
                }
            }
        });
    }

    /**
     * Update an invoice
     */
    static async updateInvoice(data: UpdateInvoiceDTO) {
        const invoice = await prisma.invoice.findUnique({
            where: { id: data.id }
        });

        if (!invoice) {
            throw new AppError('Invoice not found', ErrorCode.NOT_FOUND, 404);
        }

        const updateData: Prisma.InvoiceUpdateInput & Record<string, unknown> = {};
        if (data.status !== undefined) updateData.status = data.status;
        if (data.amount !== undefined) updateData.amount = data.amount;
        if (data.description !== undefined) updateData.description = data.description;
        if (data.connectionTitle !== undefined) updateData.connectionTitle = data.connectionTitle;
        if (data.agreementNumber !== undefined) updateData.agreementNumber = data.agreementNumber;
        if (data.projectNumber !== undefined) updateData.projectNumber = data.projectNumber;
        if (data.bomNumber !== undefined) updateData.bomNumber = data.bomNumber;
        if (data.rtomArea !== undefined) updateData.rtomArea = data.rtomArea;
        if (data.projectId !== undefined) updateData.projectId = data.projectId;

        return await prisma.invoice.update({
            where: { id: data.id },
            data: updateData,
            include: {
                contractor: {
                    select: {
                        id: true,
                        name: true,
                        contactNumber: true
                    }
                },
                project: {
                    select: {
                        id: true,
                        name: true
                    }
                }
            }
        });
    }

    /**
     * Delete an invoice (only PENDING status allowed)
     */
    static async deleteInvoice(id: string) {
        const invoice = await prisma.invoice.findUnique({
            where: { id }
        });

        if (!invoice) {
            throw new AppError('Invoice not found', ErrorCode.NOT_FOUND, 404);
        }

        if (invoice.status === 'PAID') {
            throw new AppError('Cannot delete paid invoices', ErrorCode.BAD_REQUEST, 400);
        }

        await prisma.invoice.delete({
            where: { id }
        });

        return { success: true };
    }
}
