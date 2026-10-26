import { AppError } from '@/lib/error';
import { prisma } from '@/lib/prisma';

interface InvoiceItemInput {
    description: string;
    quantity?: number;
    unitPrice?: number;
    boqItemId?: string | null;
    taskId?: string | null;
    itemType?: string;
    notes?: string | null;
}

interface CreateInvoiceInput {
    projectId: string;
    title: string;
    description?: string | null;
    type?: string;
    invoiceDate?: string | Date;
    dueDate?: string | Date | null;
    referenceNumber?: string | null;
    periodFrom?: string | Date | null;
    periodTo?: string | Date | null;
    currency?: string;
    notes?: string | null;
    taxAmount?: number;
    discountAmount?: number;
    createdById?: string | null;
    items: InvoiceItemInput[];
}

interface UpdateInvoiceInput {
    status?: 'ISSUED' | 'CANCELLED';
    cancelledReason?: string | null;
    title?: string;
    description?: string | null;
    dueDate?: string | Date | null;
    notes?: string | null;
}

export class ProjectInvoiceService {
    /**
     * Get all invoices for a project
     */
    static async getInvoices(projectId: string) {
        const invoices = await prisma.projectInvoice.findMany({
            where: { projectId },
            include: {
                items: true,
                payments: {
                    select: { pvNumber: true, amount: true, status: true, paymentDate: true }
                },
                retentions: true,
            },
            orderBy: { createdAt: 'desc' },
        });
        return invoices;
    }

    /**
     * Get all client-facing project invoices (BOM Client Invoices)
     */
    static async getAllClientInvoices() {
        const invoices = await prisma.projectInvoice.findMany({
            where: { type: 'CLIENT' },
            include: {
                items: true,
                project: {
                    select: { projectCode: true, name: true }
                }
            },
            orderBy: { createdAt: 'desc' },
        });
        return invoices;
    }

    /**
     * Create a new invoice with items in a transaction
     */
    static async createInvoice(data: CreateInvoiceInput) {
        const {
            projectId, title, description, type, invoiceDate, dueDate,
            referenceNumber, periodFrom, periodTo, currency, notes, items,
            taxAmount, discountAmount, createdById,
        } = data;

        // Verify project exists
        const project = await prisma.project.findUnique({ where: { id: projectId } });
        if (!project) {
            throw AppError.badRequest('PROJECT_NOT_FOUND');
        }

        if (!items.length) throw AppError.badRequest('INVOICE_ITEMS_REQUIRED');
        if ((taxAmount !== undefined && (!Number.isFinite(taxAmount) || taxAmount < 0))
            || (discountAmount !== undefined && (!Number.isFinite(discountAmount) || discountAmount < 0))) {
            throw AppError.badRequest('INVALID_INVOICE_ADJUSTMENT');
        }

        // Auto-generate invoice number
        const lastInv = await prisma.projectInvoice.findFirst({
            orderBy: { invoiceNumber: 'desc' },
            select: { invoiceNumber: true },
        });

        let nextNumber: string;
        if (lastInv && lastInv.invoiceNumber) {
            const lastNum = parseInt(lastInv.invoiceNumber.replace('PINV-', ''), 10);
            const nextNum = isNaN(lastNum) ? 1 : lastNum + 1;
            nextNumber = 'PINV-' + String(nextNum).padStart(5, '0');
        } else {
            nextNumber = 'PINV-00001';
        }

        // Calculate totals from items
        let subtotal = 0;
        const itemsData = items.map((item) => {
            const quantity = item.quantity ?? 1;
            const unitPrice = item.unitPrice ?? 0;
            if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(unitPrice) || unitPrice < 0) {
                throw AppError.badRequest('INVALID_INVOICE_ITEM_AMOUNT');
            }
            const totalPrice = unitPrice * quantity;
            subtotal += totalPrice;
            return {
                description: item.description,
                quantity,
                unitPrice,
                totalPrice,
                boqItemId: item.boqItemId || null,
                taskId: item.taskId || null,
                itemType: item.itemType || 'SERVICE',
                notes: item.notes || null,
            };
        });

        const tax = taxAmount || 0;
        const discount = discountAmount || 0;
        const totalAmount = subtotal + tax - discount;
        if (!Number.isFinite(totalAmount) || totalAmount <= 0 || discount > subtotal + tax) {
            throw AppError.badRequest('INVALID_INVOICE_TOTAL');
        }

        const invoice = await prisma.$transaction(async (tx) => {
            const newInvoice = await tx.projectInvoice.create({
                data: {
                    invoiceNumber: nextNumber,
                    projectId,
                    title,
                    description: description || null,
                    type: type || 'CLIENT',
                    invoiceDate: invoiceDate ? new Date(invoiceDate) : new Date(),
                    dueDate: dueDate ? new Date(dueDate) : null,
                    subtotal,
                    taxAmount: tax,
                    discountAmount: discount,
                    totalAmount,
                    paidAmount: 0,
                    balanceAmount: totalAmount,
                    currency: currency || 'LKR',
                    notes: notes || null,
                    referenceNumber: referenceNumber || null,
                    periodFrom: periodFrom ? new Date(periodFrom) : null,
                    periodTo: periodTo ? new Date(periodTo) : null,
                    createdById: createdById || null,
                    items: { create: itemsData },
                },
                include: { items: true },
            });
            return newInvoice;
        });

        return invoice;
    }

    /**
     * Update invoice details or status in a transaction
     */
    static async updateInvoice(id: string, updateFields: UpdateInvoiceInput, actorUserId: string) {
        if (!actorUserId) throw AppError.unauthorized('Authentication required');
        const invoice = await prisma.$transaction(async (tx) => {
            const existing = await tx.projectInvoice.findUnique({ where: { id } });
            if (!existing) {
                throw AppError.badRequest('INVOICE_NOT_FOUND');
            }

            const updateData: Record<string, unknown> = {};
            const hasDetailUpdates = updateFields.title !== undefined || updateFields.description !== undefined
                || updateFields.dueDate !== undefined || updateFields.notes !== undefined;
            if (updateFields.status && hasDetailUpdates) {
                throw AppError.badRequest('STATUS_AND_DETAILS_MUST_BE_UPDATED_SEPARATELY');
            }
            if (hasDetailUpdates && existing.status !== 'DRAFT') {
                throw AppError.badRequest('ONLY_DRAFT_INVOICES_CAN_BE_EDITED');
            }

            if (updateFields.status === 'ISSUED') {
                if (existing.status !== 'DRAFT') throw AppError.badRequest('ONLY_DRAFT_INVOICES_CAN_BE_ISSUED');
                if (existing.createdById && existing.createdById === actorUserId) {
                    throw AppError.badRequest('MAKER_CANNOT_ISSUE_OWN_INVOICE');
                }
                updateData.status = 'ISSUED';
                updateData.approvedById = actorUserId;
                updateData.approvedAt = new Date();
                const { LedgerService } = await import('../finance/ledger.service');
                await LedgerService.logInvoiceIssuance(tx, id, Number(existing.totalAmount), existing.type, existing.invoiceNumber);
            } else if (updateFields.status === 'CANCELLED') {
                if (!['DRAFT', 'ISSUED'].includes(existing.status)) {
                    throw AppError.badRequest('ONLY_DRAFT_OR_ISSUED_INVOICES_CAN_BE_CANCELLED');
                }
                if (Number(existing.paidAmount) > 0) throw AppError.badRequest('PAID_INVOICE_CANNOT_BE_CANCELLED');
                updateData.status = 'CANCELLED';
                updateData.cancelledReason = updateFields.cancelledReason || 'Cancelled';
                if (existing.status === 'ISSUED') {
                    const issuance = await tx.journalEntry.findFirst({
                        where: { referenceId: id, referenceType: 'INVOICE_ISSUANCE', status: 'POSTED' },
                        orderBy: { createdAt: 'desc' },
                    });
                    if (!issuance) throw AppError.badRequest('INVOICE_ISSUANCE_LEDGER_ENTRY_NOT_FOUND');
                    const { LedgerService } = await import('../finance/ledger.service');
                    await LedgerService.reverseTransaction(tx, issuance.id, updateData.cancelledReason as string, actorUserId);
                }
            }

            if (updateFields.title !== undefined) updateData.title = updateFields.title;
            if (updateFields.description !== undefined) updateData.description = updateFields.description;
            if (updateFields.dueDate !== undefined) updateData.dueDate = updateFields.dueDate ? new Date(updateFields.dueDate) : null;
            if (updateFields.notes !== undefined) updateData.notes = updateFields.notes;

            return tx.projectInvoice.update({
                where: { id },
                data: updateData,
                include: { items: true, payments: true },
            });
        });

        return invoice;
    }

    /**
     * Delete an invoice (DRAFT only)
     */
    static async deleteInvoice(id: string) {
        const existing = await prisma.projectInvoice.findUnique({ where: { id } });
        if (!existing) {
            throw AppError.badRequest('INVOICE_NOT_FOUND');
        }

        if (existing.status !== 'DRAFT') {
            throw AppError.badRequest('DRAFT_ONLY_DELETION');
        }

        await prisma.projectInvoice.delete({ where: { id } });
        return { success: true };
    }

    /**
     * Get a detailed 3-level payment breakdown and cost summary for a project
     */
    static async getPaymentSummary(projectId: string) {
        const [invoices, payments, retentions, project, expenses, boqTotal] = await Promise.all([
            prisma.projectInvoice.findMany({
                where: { projectId },
                select: {
                    id: true,
                    invoiceNumber: true,
                    title: true,
                    status: true,
                    totalAmount: true,
                    paidAmount: true,
                    balanceAmount: true,
                    type: true,
                    invoiceDate: true,
                    payments: {
                        select: {
                            pvNumber: true,
                            amount: true,
                            status: true,
                            paymentDate: true,
                            paymentMethod: true,
                        },
                        orderBy: { paymentDate: 'desc' },
                    },
                },
                orderBy: { invoiceDate: 'asc' },
            }),
            prisma.paymentVoucher.aggregate({
                where: { projectId },
                _sum: { amount: true },
                _count: { id: true },
            }),
            prisma.projectRetention.findMany({
                where: { projectId },
                select: {
                    id: true,
                    title: true,
                    status: true,
                    retentionPercent: true,
                    retentionAmount: true,
                    releaseCondition: true,
                    defectLiabilityPeriod: true,
                    releases: {
                        select: { releaseAmount: true, releaseDate: true },
                        orderBy: { releaseDate: 'desc' },
                    },
                },
            }),
            prisma.project.findUnique({
                where: { id: projectId },
                select: { budget: true, actualCost: true, name: true },
            }),
            prisma.projectExpense.aggregate({
                where: { projectId },
                _sum: { amount: true },
            }),
            prisma.projectBOQItem.aggregate({
                where: { projectId },
                _sum: { amount: true },
            }),
        ]);

        const totalInvoiced = invoices.reduce((s, i) => s + Number(i.totalAmount), 0);
        const totalPaid = invoices.reduce((s, i) => s + Number(i.paidAmount), 0);
        const totalBalance = invoices.reduce((s, i) => s + Number(i.balanceAmount), 0);
        const totalRetained = retentions
            .filter((r) => r.status === 'HELD')
            .reduce((s, r) => s + Number(r.retentionAmount), 0);
        const totalReleased = retentions
            .filter((r) => r.status === 'RELEASED')
            .reduce((s, r) => s + Number(r.retentionAmount), 0);

        const boqEstimate = Number(boqTotal._sum.amount ?? 0);
        const budget = Number(project?.budget ?? 0);
        const actualCost = Number(project?.actualCost ?? 0);

        return {
            project: {
                id: projectId,
                name: project?.name,
                budget,
                boqEstimate,
                actualCost,
                costVariance: budget - actualCost,
            },
            paymentSummary: {
                totalInvoiced,
                totalPaid,
                totalBalance,
                paymentProgress: totalInvoiced > 0 ? Math.round((totalPaid / totalInvoiced) * 100) : 0,
                paymentCount: payments._count.id,
                totalPaymentAmount: Number(payments._sum.amount ?? 0),
                expenses: Number(expenses._sum.amount ?? 0),
                totalRetained,
                totalReleasedRetentions: totalReleased,
            },
            invoices: invoices.map((inv) => ({
                ...inv,
                paymentBreakdown: [
                    { level: 1, label: 'Advance Payment (30%)', amount: Number(inv.totalAmount) * 0.3 },
                    { level: 2, label: 'Work Completion (50%)', amount: Number(inv.totalAmount) * 0.5 },
                    { level: 3, label: 'Final + Retention Release (20%)', amount: Number(inv.totalAmount) * 0.2 },
                ],
            })),
            retentions,
        };
    }
}

