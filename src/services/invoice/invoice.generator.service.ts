import { createHash } from 'node:crypto';
import { AppError } from '@/lib/error';
import { prisma } from '@/lib/prisma';
import { InvoiceCalculatorService } from './invoice.calculator.service';
import { LedgerService } from '../finance/ledger.service';
import { resolveOpmcScope } from '@/lib/opmc-scope';
import { validateSodForInvoicing } from '../service-order/sod-financial-validation';
import { TransactionClient } from '@/types/inventory/inventory-service.types';

type InvoiceDbClient = typeof prisma | TransactionClient;

export class InvoiceGeneratorService {
    /**
     * Generate a Contractor Monthly Invoice
     */
    static async generateContractorMonthlyInvoice(data: {
        contractorId: string;
        month?: string | number;
        year?: string | number;
        sodIds?: string[];
        /** The invoice's own area (the area of its orders). Without it the contractor's home area is used. */
        opmcId?: string;
        /** Orders completed in an earlier month than the billing month may be on this invoice (late SODs). */
        allowLate?: boolean;
        description?: string;
        retentionPercent?: number;
        whtPercent?: number;
        advanceDeduction?: number;
    }, userId: string, transaction?: TransactionClient) {
        if (!userId) throw AppError.unauthorized('Authenticated billing user is required');

        const db: InvoiceDbClient = transaction || prisma;

        const now = new Date();
        const currentYear = data.year ? Number(data.year) : now.getFullYear();
        const currentMonth = data.month ? Number(data.month) : now.getMonth() + 1;

        if (!Number.isInteger(currentYear) || currentYear < 2000 || currentYear > 2200) {
            throw AppError.badRequest('Invalid invoice year');
        }
        if (!Number.isInteger(currentMonth) || currentMonth < 1 || currentMonth > 12) {
            throw AppError.badRequest('Invalid invoice month');
        }
        const retentionPercent = Number(data.retentionPercent ?? 0);
        const whtPercent = Number(data.whtPercent ?? 0);
        const advanceDeduction = Number(data.advanceDeduction ?? 0);
        if (!Number.isFinite(retentionPercent) || retentionPercent < 0 || retentionPercent > 100) {
            throw AppError.badRequest('Invalid retention percentage');
        }
        if (!Number.isFinite(whtPercent) || whtPercent < 0 || whtPercent > 100) {
            throw AppError.badRequest('Invalid WHT percentage');
        }
        if (!Number.isFinite(advanceDeduction) || advanceDeduction < 0) {
            throw AppError.badRequest('Invalid advance deduction');
        }

        const contractor = await db.contractor.findUnique({
            where: { id: data.contractorId },
            include: { opmc: true }
        });

        if (!contractor) throw AppError.notFound('Contractor not found');

        const accessibleOpmcs = await resolveOpmcScope(userId);
        const areaId = data.opmcId ?? contractor.opmcId;
        if (accessibleOpmcs !== undefined && (!areaId || !accessibleOpmcs.includes(areaId))) {
            throw AppError.forbidden('The area of this invoice is outside your OPMC access');
        }
        const area = data.opmcId ? await db.oPMC.findUnique({ where: { id: data.opmcId }, select: { rtom: true } }) : contractor.opmc;
        if (data.opmcId && !area) throw AppError.notFound('Area not found');

        const periodStart = new Date(Date.UTC(currentYear, currentMonth - 1, 1));
        const periodEnd = new Date(Date.UTC(currentYear, currentMonth, 1));

        let sodWhere: Record<string, unknown> = {
            contractorId: data.contractorId,
            completedDate: { gte: periodStart, lt: periodEnd },
            OR: [
                { status: { in: ['COMPLETED', 'INSTALL_CLOSED'] } },
                { sltsStatus: 'COMPLETED' }
            ],
            isInvoicable: true,
            invoiced: false,
            invoiceId: null,
            ...(accessibleOpmcs !== undefined ? { opmcId: { in: accessibleOpmcs } } : {})
        };

        if (data.sodIds && data.sodIds.length > 0) {
            sodWhere = {
                id: { in: data.sodIds },
                contractorId: data.contractorId,
                ...(data.opmcId ? { opmcId: data.opmcId } : {}),
                completedDate: data.allowLate ? { lt: periodEnd } : { gte: periodStart, lt: periodEnd },
                OR: [
                    { status: { in: ['COMPLETED', 'INSTALL_CLOSED'] } },
                    { sltsStatus: 'COMPLETED' }
                ],
                isInvoicable: true,
                invoiced: false,
                invoiceId: null,
                ...(accessibleOpmcs !== undefined ? { opmcId: { in: accessibleOpmcs } } : {})
            };
        }

        const sods = await db.serviceOrder.findMany({
            where: sodWhere,
            include: {
                materialUsage: { include: { item: true } }
            }
        });

        if (sods.length === 0) {
            throw AppError.badRequest('No verified invoicable SODs found for this contractor. Ensure SODs are completed and marked Invoicable by an Engineer first.');
        }

        if (data.sodIds && data.sodIds.length !== sods.length) {
            throw AppError.badRequest('One or more selected SODs are outside the invoice period, scope, or already invoiced');
        }

        const regionName = area?.rtom || 'METRO';
        const contractorPrefix = contractor.registrationNumber ? contractor.registrationNumber.slice(-4) : 'LOTS';

        const invoiceNumber = await this.generateUniqueNumber(
            contractorPrefix,
            regionName,
            currentYear,
            currentMonth,
            db
        );

        const invalidSods = sods
            .map((sod) => ({
                soNum: sod.soNum,
                ...validateSodForInvoicing(sod)
            }))
            .filter((result) => !result.eligible);
        if (invalidSods.length > 0) {
            throw AppError.validation(
                'Invoice generation blocked: one or more SODs do not have a complete financial/material snapshot.',
                { invalidSods }
            );
        }

        let totalGrossAmount = 0;
        for (const sod of sods) {
            if (sod.contractorAmount === null) {
                throw AppError.badRequest(`SOD_CONTRACTOR_AMOUNT_MISSING: ${sod.soNum}`);
            }
            totalGrossAmount += Number(sod.contractorAmount);
        }
        const retentionAmount = totalGrossAmount * retentionPercent / 100;
        const whtAmount = totalGrossAmount * whtPercent / 100;
        if (retentionAmount + whtAmount + advanceDeduction > totalGrossAmount) {
            throw AppError.badRequest('Invoice deductions cannot exceed the verified contractor amount');
        }

        const sodIdsList = sods.map(s => s.id);
        const baseKey = `CONTRACTOR_MONTHLY_INVOICE_${contractor.id}_${currentYear}_${currentMonth}_${createHash('sha1').update([...sodIdsList].sort().join(',')).digest('hex').slice(0, 16)}`;
        const earlier = await db.idempotencyLog.count({ where: { idempotencyKey: { startsWith: baseKey } } });
        const reissueKey = earlier > 0 ? `${baseKey}_R${earlier}` : baseKey;
        const invoice = await this.createRegionalInvoice({
            invoiceNumber,
            contractorId: contractor.id,
            opmcId: areaId ?? null,
            year: currentYear,
            month: currentMonth,
            totalAmount: totalGrossAmount,
            retentionAmount,
            whtAmount,
            whtPercent,
            advanceDeduction,
            regionName,
            sodIds: sodIdsList,
            rtomArea: regionName,
            description: data.description || `Contractor Monthly Invoice for ${contractor.name} - ${regionName} (${currentMonth}/${currentYear})`,
            // The same selection of orders cannot be submitted twice at once, but it can be invoiced again after an earlier invoice of it was
            // cancelled (rejected or disputed): each re-issue gets its own key. A second request for orders that are still on an invoice is
            // refused by the claim check on the orders themselves.
            idempotencyKey: reissueKey
        }, transaction);

        // Open the approval gate once the invoice is saved (a missed start is healed the next time anyone opens the approvals queue)
        if (!transaction) {
            void import('@/services/invoice/invoice-gate.service').then(({ InvoiceGateService }) => InvoiceGateService.startFor(invoice.id, 'Invoice created')).catch((e) => console.error('[InvoiceGate] start after invoice creation failed:', e));
        }

        const auditPayload = {
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
        };
        if (transaction) {
            await transaction.auditLog.create({
                data: {
                    userId: userId || null,
                    action: auditPayload.action,
                    entity: auditPayload.entity,
                    entityId: auditPayload.entityId,
                    newValue: auditPayload.newValue,
                }
            });
        } else {
            const { AuditService } = await import('../audit');
            await AuditService.log(auditPayload);
        }

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
        month: number,
        db: InvoiceDbClient = prisma
    ): Promise<string> {
        const yearShort = year.toString().slice(-2);
        const monthPad = month.toString().padStart(2, '0');
        const regClean = regionName.toUpperCase().replace(/[^A-Z0-9]/g, '');
        
        const pattern = `INV/${contractorPrefix}/${regClean}/${yearShort}/${monthPad}-`;
        
        // Find the latest invoice number with this pattern to increment sequence
        const latestInvoice = await db.invoice.findFirst({
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
        opmcId?: string | null;
        year: number;
        month: number;
        totalAmount: number;
        retentionAmount?: number;
        whtAmount?: number;
        whtPercent?: number;
        advanceDeduction?: number;
        regionName: string;
        sodIds: string[];
        penaltyTotal?: number;
        penaltiesList?: { amount: number; reason: string; description?: string; serviceOrderId?: string }[];
        bomNumber?: string | null;
        rtomArea?: string | null;
        description?: string;
        idempotencyKey?: string;
    }, transaction?: TransactionClient) {
        const { totalAmount, penaltyTotal = 0, penaltiesList = [], idempotencyKey, retentionAmount = 0, whtAmount = 0, whtPercent = 0, advanceDeduction = 0, ...other } = data;
        const { amountA, amountB } = InvoiceCalculatorService.calculateSplit(totalAmount, penaltyTotal);

        const create = async (tx: TransactionClient) => {
            if (idempotencyKey) {
                const existingLog = await tx.idempotencyLog.findUnique({ where: { idempotencyKey } });
                if (existingLog) throw AppError.badRequest('Duplicate request');
                await tx.idempotencyLog.create({ data: { idempotencyKey, actionType: 'GENERATE_INVOICE', status: 'SUCCESS' } });
            }
            // Serialize the claim of each SOD so two billing requests cannot
            // both read the same unbilled rows and create competing invoices.
            for (const sodId of [...other.sodIds].sort()) {
                await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${sodId}::text, 0))`;
            }
            const claimableCount = await tx.serviceOrder.count({
                where: { id: { in: other.sodIds }, invoiced: false, invoiceId: null }
            });
            if (claimableCount !== other.sodIds.length) {
                throw AppError.conflict('One or more SODs were already claimed by another invoice request');
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
                    opmcId: other.opmcId ?? null,
                    projectId,
                    year: other.year,
                    month: other.month,
                    totalAmount: totalAmount,
                    amount: totalAmount,
                    retentionAmount,
                    whtAmount,
                    whtPercent,
                    advanceDeduction,
                    amountA,
                    statusA: 'PENDING_SF_AUDIT',
                    // The area approval gate (Area Coordinator, QC, Contractor, Engineer, Area Manager) starts on the invoice; only after it
                    // does the invoice reach OSP Quality (SF Audit). IN_GATE = waiting for the gate to be started.
                    confirmStage: 'IN_GATE',
                    contractorConfirmStatus: 'AWAITING',
                    // SF Audit verifies, Finance sends it to the OSP managers, they approve, then Head Office pays
                    approvalFlow: 'OSP_CHAIN',
                    amountB,
                    statusB: 'HOLD',
                    status: 'PENDING_SF_AUDIT',
                    description: other.description || `Monthly Invoice for ${other.regionName} - ${other.month}/${other.year}`,
                    bomNumber,
                    rtomArea,
                    connectionTitle,
                    projectNumber,
                    idempotencyKey,
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
        };

        return transaction ? create(transaction) : prisma.$transaction(create, { timeout: 60_000, maxWait: 10_000 });
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
