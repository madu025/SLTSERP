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
    status?: string;
    cancelledReason?: string | null;
    paidAmount?: number;
    title?: string;
    description?: string | null;
    dueDate?: string | Date | null;
    notes?: string | null;
    approvedById?: string | null;
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
            throw new Error('PROJECT_NOT_FOUND');
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
            const totalPrice = (item.unitPrice || 0) * (item.quantity || 1);
            subtotal += totalPrice;
            return {
                description: item.description,
                quantity: item.quantity || 1,
                unitPrice: item.unitPrice || 0,
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
    static async updateInvoice(id: string, updateFields: UpdateInvoiceInput) {
        const invoice = await prisma.$transaction(async (tx) => {
            const existing = await tx.projectInvoice.findUnique({ where: { id } });
            if (!existing) {
                throw new Error('INVOICE_NOT_FOUND');
            }

            const updateData: Record<string, unknown> = {};
            if (updateFields.status) updateData.status = updateFields.status;
            if (updateFields.cancelledReason) updateData.cancelledReason = updateFields.cancelledReason;

            // Handle status transitions
            if (updateFields.status === 'ISSUED' && existing.status !== 'ISSUED') {
                updateData.approvedById = updateFields.approvedById || null;
                updateData.approvedAt = new Date();
                
                // Log invoice finalization in General Ledger
                const { LedgerService } = await import('../finance/ledger.service');
                await LedgerService.logInvoiceIssuance(tx, id, existing.totalAmount, existing.type, existing.invoiceNumber);
            } else if (updateFields.status === 'CANCELLED') {
                updateData.cancelledReason = updateFields.cancelledReason || 'Cancelled';
            }

            // Handle payment updates
            if (updateFields.paidAmount !== undefined) {
                const newPaidAmount = (existing.paidAmount || 0) + updateFields.paidAmount;
                const newBalance = existing.totalAmount - newPaidAmount;
                updateData.paidAmount = newPaidAmount;
                updateData.balanceAmount = Math.max(0, newBalance);
                if (newBalance <= 0 && existing.status !== 'CANCELLED') {
                    updateData.status = 'FULLY_PAID';
                } else if (newPaidAmount > 0 && existing.status === 'ISSUED') {
                    updateData.status = 'PARTIALLY_PAID';
                }
            }

            // Apply other updates
            if (updateFields.title) updateData.title = updateFields.title;
            if (updateFields.description !== undefined) updateData.description = updateFields.description;
            if (updateFields.dueDate) updateData.dueDate = new Date(updateFields.dueDate);
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
            throw new Error('INVOICE_NOT_FOUND');
        }

        if (existing.status !== 'DRAFT') {
            throw new Error('DRAFT_ONLY_DELETION');
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

        const totalInvoiced = invoices.reduce((s, i) => s + i.totalAmount, 0);
        const totalPaid = invoices.reduce((s, i) => s + i.paidAmount, 0);
        const totalBalance = invoices.reduce((s, i) => s + i.balanceAmount, 0);
        const totalRetained = retentions
            .filter((r) => r.status === 'HELD')
            .reduce((s, r) => s + r.retentionAmount, 0);
        const totalReleased = retentions
            .filter((r) => r.status === 'RELEASED')
            .reduce((s, r) => s + r.retentionAmount, 0);

        const boqEstimate = boqTotal._sum.amount ?? 0;
        const budget = project?.budget ?? 0;
        const actualCost = project?.actualCost ?? 0;

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
                totalPaymentAmount: payments._sum.amount ?? 0,
                expenses: expenses._sum.amount ?? 0,
                totalRetained,
                totalReleasedRetentions: totalReleased,
            },
            invoices: invoices.map((inv) => ({
                ...inv,
                paymentBreakdown: [
                    { level: 1, label: 'Advance Payment (30%)', amount: inv.totalAmount * 0.3 },
                    { level: 2, label: 'Work Completion (50%)', amount: inv.totalAmount * 0.5 },
                    { level: 3, label: 'Final + Retention Release (20%)', amount: inv.totalAmount * 0.2 },
                ],
            })),
            retentions,
        };
    }
}

