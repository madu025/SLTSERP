import { AppError } from '@/lib/error';
import { prisma } from '@/lib/prisma';
import { InvoiceCalculatorService } from './invoice.calculator.service';
import { LedgerService } from '../finance/ledger.service';

export class InvoiceGeneratorService {
    /**
     * Generate a Contractor Monthly Invoice
     */
    static async generateContractorMonthlyInvoice(data: {
        contractorId: string;
        month?: string | number;
        year?: string | number;
        sodIds?: string[];
    }, userId: string = 'system-billing-officer') {
        const now = new Date();
        const currentYear = data.year ? Number(data.year) : now.getFullYear();
        const currentMonth = data.month ? Number(data.month) : now.getMonth() + 1;

        let sodWhere: Record<string, unknown> = {
            contractorId: data.contractorId,
            OR: [
                { status: { in: ['COMPLETED', 'INSTALL_CLOSED'] } },
                { sltsStatus: 'COMPLETED' }
            ],
            isInvoicable: true,
            invoiced: false
        };

        if (data.sodIds && data.sodIds.length > 0) {
            sodWhere = {
                id: { in: data.sodIds },
                contractorId: data.contractorId,
                OR: [
                    { status: { in: ['COMPLETED', 'INSTALL_CLOSED'] } },
                    { sltsStatus: 'COMPLETED' }
                ],
                isInvoicable: true,
                invoiced: false
            };
        }

        const sods = await prisma.serviceOrder.findMany({
            where: sodWhere,
            include: {
                materialUsage: { include: { item: true } }
            }
        });

        if (sods.length === 0) {
            throw AppError.badRequest('No verified invoicable SODs found for this contractor. Ensure SODs are completed and marked Invoicable by an Engineer first.');
        }

        const contractor = await prisma.contractor.findUnique({
            where: { id: data.contractorId },
            include: { opmc: true }
        });

        if (!contractor) {
            throw AppError.notFound('Contractor not found');
        }

        const regionName = contractor.opmc?.rtom || 'METRO';
        const contractorPrefix = contractor.registrationNumber ? contractor.registrationNumber.slice(-4) : 'LOTS';

        const invoiceNumber = await this.generateUniqueNumber(
            contractorPrefix,
            regionName,
            currentYear,
            currentMonth
        );

        let totalGrossAmount = 0;
        // Import SODInvoicingService dynamically to prevent circular dependencies if they exist
        const { SODInvoicingService } = await import('../sod/sod.invoicing.service');
        
        for (const sod of sods) {
            const dwUsage = sod.materialUsage.find((m) => {
                const itemCode = (m.item?.code || '').toUpperCase();
                const itemName = (m.item?.name || '').toUpperCase();
                return itemCode === 'OSP-HC-CBL-DW' || itemName.includes('DROP CABLE') || itemName.includes('DROP WIRE');
            });
            const dwLength = dwUsage ? parseFloat(dwUsage.quantity.toString()) : 150;
            const calc = await SODInvoicingService.calculateAmounts(sod.rtom, dwLength, { serviceType: sod.serviceType });
            totalGrossAmount += calc.contractorAmount;
        }

        const sodIdsList = sods.map(s => s.id);
        const invoice = await this.createRegionalInvoice({
            invoiceNumber,
            contractorId: contractor.id,
            year: currentYear,
            month: currentMonth,
            totalAmount: totalGrossAmount,
            regionName,
            sodIds: sodIdsList,
            rtomArea: regionName,
            description: `Contractor Monthly Invoice for ${contractor.name} - ${regionName} (${currentMonth}/${currentYear})`
        });

        const { AuditService } = await import('../audit');
        await AuditService.log({
            action: 'CONTRACTOR_INVOICE_GENERATED',
            entity: 'Invoice',
            entityId: invoice.id,
            userId: userId,
            newValue: {
                invoiceNumber: invoice.invoiceNumber,
                contractorName: contractor.name,
                sodCount: sods.length,
                totalAmount: totalGrossAmount,
                generatedBy: userId
            }
        });

        const publicUrl = `/public/invoices/${invoice.id}`;

        return {
            invoice,
            sods,
            totalGrossAmount,
            publicUrl
        };
    }

    
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
     * Create actual invoice record and connect SODs in a transaction, including penalties.
     * Initial Status: PENDING_SF_AUDIT
     */
    static async createRegionalInvoice(data: {
        invoiceNumber: string;
        contractorId: string;
        year: number;
        month: number;
import { AppError } from '@/lib/error';
import { prisma } from '@/lib/prisma';
import { InvoiceCalculatorService } from './invoice.calculator.service';
import { LedgerService } from '../finance/ledger.service';

export class InvoiceGeneratorService {
    /**
     * Generate a Contractor Monthly Invoice
     */
    static async generateContractorMonthlyInvoice(data: {
        contractorId: string;
        month?: string | number;
        year?: string | number;
        sodIds?: string[];
    }, userId: string = 'system-billing-officer') {
        const now = new Date();
        const currentYear = data.year ? Number(data.year) : now.getFullYear();
        const currentMonth = data.month ? Number(data.month) : now.getMonth() + 1;

        let sodWhere: Record<string, unknown> = {
            contractorId: data.contractorId,
            OR: [
                { status: { in: ['COMPLETED', 'INSTALL_CLOSED'] } },
                { sltsStatus: 'COMPLETED' }
            ],
            isInvoicable: true,
            invoiced: false
        };

        if (data.sodIds && data.sodIds.length > 0) {
            sodWhere = {
                id: { in: data.sodIds },
                contractorId: data.contractorId,
                OR: [
                    { status: { in: ['COMPLETED', 'INSTALL_CLOSED'] } },
                    { sltsStatus: 'COMPLETED' }
                ],
                isInvoicable: true,
                invoiced: false
            };
        }

        const sods = await prisma.serviceOrder.findMany({
            where: sodWhere,
            include: {
                materialUsage: { include: { item: true } }
            }
        });

        if (sods.length === 0) {
            throw AppError.badRequest('No verified invoicable SODs found for this contractor. Ensure SODs are completed and marked Invoicable by an Engineer first.');
        }

        const contractor = await prisma.contractor.findUnique({
            where: { id: data.contractorId },
            include: { opmc: true }
        });

        if (!contractor) {
            throw AppError.notFound('Contractor not found');
        }

        const regionName = contractor.opmc?.rtom || 'METRO';
        const contractorPrefix = contractor.registrationNumber ? contractor.registrationNumber.slice(-4) : 'LOTS';

        const invoiceNumber = await this.generateUniqueNumber(
            contractorPrefix,
            regionName,
            currentYear,
            currentMonth
        );

        let totalGrossAmount = 0;
        // Import SODInvoicingService dynamically to prevent circular dependencies if they exist
        const { SODInvoicingService } = await import('../sod/sod.invoicing.service');
        
        for (const sod of sods) {
            const dwUsage = sod.materialUsage.find((m) => {
                const itemCode = (m.item?.code || '').toUpperCase();
                const itemName = (m.item?.name || '').toUpperCase();
                return itemCode === 'OSP-HC-CBL-DW' || itemName.includes('DROP CABLE') || itemName.includes('DROP WIRE');
            });
            const dwLength = dwUsage ? parseFloat(dwUsage.quantity.toString()) : 150;
            const calc = await SODInvoicingService.calculateAmounts(sod.rtom, dwLength, { serviceType: sod.serviceType });
            totalGrossAmount += calc.contractorAmount;
        }

        const sodIdsList = sods.map(s => s.id);
        const invoice = await this.createRegionalInvoice({
            invoiceNumber,
            contractorId: contractor.id,
            year: currentYear,
            month: currentMonth,
            totalAmount: totalGrossAmount,
            regionName,
            sodIds: sodIdsList,
            rtomArea: regionName,
            description: `Contractor Monthly Invoice for ${contractor.name} - ${regionName} (${currentMonth}/${currentYear})`
        });

        const { AuditService } = await import('../audit');
        await AuditService.log({
            action: 'CONTRACTOR_INVOICE_GENERATED',
            entity: 'Invoice',
            entityId: invoice.id,
            userId: userId,
            newValue: {
                invoiceNumber: invoice.invoiceNumber,
                contractorName: contractor.name,
                sodCount: sods.length,
                totalAmount: totalGrossAmount,
                generatedBy: userId
            }
        });

        const publicUrl = `/public/invoices/${invoice.id}`;

        return {
            invoice,
            sods,
            totalGrossAmount,
            publicUrl
        };
    }

    
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
     * Create actual invoice record and connect SODs in a transaction, including penalties.
     * Initial Status: PENDING_SF_AUDIT
     */
    static async createRegionalInvoice(data: {
        invoiceNumber: string;
        contractorId: string;
        year: number;
        month: number;
        totalAmount: number;
        regionName: string;
        sodIds: string[];
        penaltyTotal?: number;
        penaltiesList?: { amount: number; reason: string; description?: string; serviceOrderId?: string }[];
        bomNumber?: string | null;
        rtomArea?: string | null;
        description?: string;
        idempotencyKey?: string;
    }) {
        const { totalAmount, penaltyTotal = 0, penaltiesList = [], idempotencyKey, ...other } = data;
        const { amountA, amountB } = InvoiceCalculatorService.calculateSplit(totalAmount, penaltyTotal);

        return await prisma.$transaction(async (tx) => {
            if (idempotencyKey) {
                const existing = await tx.invoice.findUnique({ where: { idempotencyKey } });
                if (existing) return existing;
            }
            let bomNumber = other.bomNumber;
            let projectId = null;
            let projectNumber = null;
            let connectionTitle = null;

            const associatedSod = await tx.serviceOrder.findFirst({
                where: {
                    id: { in: other.sodIds },
                    projectInvoiceId: { not: null }
                },
                include: {
                    projectInvoice: {
                        include: {
                            project: true
                        }
                    }
                }
            });

            if (associatedSod && associatedSod.projectInvoice) {
                if (bomNumber === undefined || bomNumber === null) {
                    bomNumber = associatedSod.projectInvoice.referenceNumber || null;
                }
                const project = associatedSod.projectInvoice.project;
                if (project) {
                    projectId = project.id;
                    connectionTitle = `${project.name} - connections`;
                    const digits = project.projectCode.match(/\d+/);
                    if (digits) {
                        projectNumber = parseInt(digits[0], 10);
                    }
                }
            }

            if (!projectId) {
                let project = await tx.project.findFirst({
                    where: { contractorId: other.contractorId },
                    orderBy: { createdAt: 'desc' }
                });
                
                if (!project) {
                    project = await tx.project.findFirst({
                        where: {
                            OR: [
                                { name: { contains: 'BOM' } },
                                { name: { contains: 'Invoicing' } },
                                { projectCode: { contains: 'SERV' } }
                            ]
                        }
                    });
                }

                if (!project) {
                    project = await tx.project.findFirst({
                        orderBy: { createdAt: 'desc' }
                    });
                }

                if (project) {
                    projectId = project.id;
                    connectionTitle = `${project.name} - connections`;
                    const digits = project.projectCode.match(/\d+/);
                    if (digits) {
                        projectNumber = parseInt(digits[0], 10);
                    } else {
                        projectNumber = 260103;
                    }
                }
            }

            let rtomArea = other.rtomArea;
            if (!rtomArea) {
                const firstSod = await tx.serviceOrder.findFirst({
                    where: { id: { in: other.sodIds } },
                    select: { rtom: true }
                });
                rtomArea = firstSod?.rtom || other.regionName;
            }

            const invoice = await tx.invoice.create({
                data: {
                    invoiceNumber: other.invoiceNumber,
                    contractorId: other.contractorId,
                    projectId,
                    year: other.year,
                    month: other.month,
                    totalAmount: totalAmount,
                    amount: totalAmount,
                    amountA,
                    statusA: 'PENDING_SF_AUDIT',
                    amountB,
                    statusB: 'HOLD',
                    status: 'PENDING_SF_AUDIT',
                    description: other.description || `Monthly Invoice for ${other.regionName} - ${other.month}/${other.year}`,
                    bomNumber,
                    rtomArea,
                    connectionTitle,
                    projectNumber,
                    sods: { connect: other.sodIds.map(id => ({ id })) },
                    penalties: {
                        create: penaltiesList.map(p => ({
                            amount: p.amount,
                            reason: p.reason,
                            description: p.description,
                            serviceOrderId: p.serviceOrderId,
                            status: 'APPROVED',
                            proposedBy: 'SYSTEM'
                        }))
                    }
                } as import('@prisma/client').Prisma.InvoiceUncheckedCreateInput
            });

            await tx.serviceOrder.updateMany({
                where: { id: { in: other.sodIds } },
                data: { invoiced: true, invoiceId: invoice.id }
            });

            // 7. General Ledger: reclassify Unbilled WIP to AR, record output
            //    taxes (VAT/SSCL), and accrue contractor payable & retention.
            //    Revenue itself was already recognized at SOD completion, so it
            //    is not re-recognized here (single authoritative trigger point).
            await LedgerService.logInvoiceGeneration(
                tx,
                invoice.id,
                invoice.invoiceNumber,
                Number(invoice.totalAmount), // Total Revenue (relieving WIP)
                amountA,             // Contractor Payable
                amountB,             // Retention Liability
                `Enterprise Ledger GL Posting for Invoice: ${invoice.invoiceNumber}`,
                Number(invoice.vatAmount), // Output VAT (0 unless statutory breakdown applied)
                Number(invoice.ssclAmount) // SSCL (0 unless statutory breakdown applied)
            );

            return invoice;
        });
    }

    /**
     * Recalculate splits (amountA / amountB) for an invoice based on its associated Penalty records
     */
    static async recalculateInvoiceSplits(invoiceId: string, tx?: import('@prisma/client').Prisma.TransactionClient) {
        const db = (tx as unknown as import('@prisma/client').PrismaClient) || prisma;
        const invoice = await db.invoice.findUnique({
            where: { id: invoiceId },
            include: { penalties: true }
        });
        if (!invoice) throw AppError.badRequest('Invoice not found');

        const penaltyTotal = invoice.penalties
            .filter((p: import('@prisma/client').Penalty) => p.status === 'APPROVED')
            .reduce((sum: number, p: import('@prisma/client').Penalty) => sum + Number(p.amount), 0);
        const { amountA, amountB } = InvoiceCalculatorService.calculateSplit(Number(invoice.totalAmount), penaltyTotal);

        return await db.invoice.update({
            where: { id: invoiceId },
            data: {
                amountA,
                amountB
            }
        });
    }
}
