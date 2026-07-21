import { AppError } from '@/lib/error';
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
     * Create actual invoice record and connect SODs in a transaction, including penalties
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
    }) {
        const { totalAmount, penaltyTotal = 0, penaltiesList = [], ...other } = data;
        const { amountA, amountB } = InvoiceCalculatorService.calculateSplit(totalAmount, penaltyTotal);

        return await prisma.$transaction(async (tx) => {
            // Find any associated project invoice to extract the BOM reference number, project ID, and metadata
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

            // Fallback: If no direct ProjectInvoice association is found, look up active projects
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
                        projectNumber = 260103; // standard fallback project number
                    }
                }
            }

            // Get the RTOM area name from the first SOD if not provided
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
                    statusA: 'PENDING',
                    amountB,
                    statusB: 'HOLD',
                    status: 'PENDING',
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
                } as any
            });

            await tx.serviceOrder.updateMany({
                where: { id: { in: other.sodIds } },
                data: { invoiced: true, invoiceId: invoice.id }
            });

            return invoice;
        });
    }

    /**
     * Recalculate splits (amountA / amountB) for an invoice based on its associated Penalty records
     */
    
    static async recalculateInvoiceSplits(invoiceId: string, tx?: any) {
        const db = tx || prisma;
        const invoice = await db.invoice.findUnique({
            where: { id: invoiceId },
            include: { penalties: true }
        });
        if (!invoice) throw AppError.badRequest('Invoice not found');

        
        const penaltyTotal = invoice.penalties
            .filter((p: any) => p.status === 'APPROVED')
            .reduce((sum: number, p: any) => sum + p.amount, 0);
        const { amountA, amountB } = InvoiceCalculatorService.calculateSplit(invoice.totalAmount, penaltyTotal);

        return await db.invoice.update({
            where: { id: invoiceId },
            data: {
                amountA,
                amountB
            }
        });
    }
}
