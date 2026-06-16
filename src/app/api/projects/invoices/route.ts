import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/projects/invoices?projectId=xxx - List invoices by project
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const projectId = searchParams.get('projectId');

        if (!projectId) {
            return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
        }

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

        return NextResponse.json(invoices);
    } catch (error: any) {
        console.error('Error fetching invoices:', error);
        return NextResponse.json({ error: 'Failed to fetch invoices' }, { status: 500 });
    }
}

// POST /api/projects/invoices - Create a new invoice
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const {
            projectId, title, description, type, invoiceDate, dueDate,
            referenceNumber, periodFrom, periodTo, currency, notes, items,
            taxAmount, discountAmount, createdById,
        } = body;

        if (!projectId || !title || !items?.length) {
            return NextResponse.json(
                { error: 'projectId, title, and items are required' },
                { status: 400 }
            );
        }

        // Verify project exists
        const project = await prisma.project.findUnique({ where: { id: projectId } });
        if (!project) {
            return NextResponse.json({ error: 'Project not found' }, { status: 404 });
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
        const itemsData = items.map((item: any) => {
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

        return NextResponse.json(invoice, { status: 201 });
    } catch (error: any) {
        console.error('Error creating invoice:', error);
        return NextResponse.json({ error: 'Failed to create invoice' }, { status: 500 });
    }
}

// PATCH /api/projects/invoices - Update invoice status or details
export async function PATCH(request: NextRequest) {
    try {
        const body = await request.json();
        const { id, status, approvedById, cancelledReason, paidAmount, ...updateFields } = body;

        if (!id) {
            return NextResponse.json({ error: 'id is required' }, { status: 400 });
        }

        const invoice = await prisma.$transaction(async (tx) => {
            const existing = await tx.projectInvoice.findUnique({ where: { id } });
            if (!existing) {
                throw new Error('Invoice not found');
            }

            const updateData: any = {};
            if (status) updateData.status = status;
            if (cancelledReason) updateData.cancelledReason = cancelledReason;

            // Handle status transitions
            if (status === 'ISSUED') {
                updateData.approvedById = approvedById || null;
                updateData.approvedAt = new Date();
            } else if (status === 'CANCELLED') {
                updateData.cancelledReason = cancelledReason || 'Cancelled';
            }

            // Handle payment updates
            if (paidAmount !== undefined) {
                const newPaidAmount = (existing.paidAmount || 0) + paidAmount;
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

        return NextResponse.json(invoice);
    } catch (error: any) {
        console.error('Error updating invoice:', error);
        if (error.message === 'Invoice not found') {
            return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
        }
        return NextResponse.json({ error: 'Failed to update invoice' }, { status: 500 });
    }
}

// DELETE /api/projects/invoices - Delete a DRAFT invoice
export async function DELETE(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'id is required' }, { status: 400 });
        }

        const existing = await prisma.projectInvoice.findUnique({ where: { id } });
        if (!existing) {
            return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
        }

        if (existing.status !== 'DRAFT') {
            return NextResponse.json(
                { error: 'Only DRAFT invoices can be deleted' },
                { status: 400 }
            );
        }

        await prisma.projectInvoice.delete({ where: { id } });
        return NextResponse.json({ message: 'Invoice deleted successfully' });
    } catch (error: any) {
        console.error('Error deleting invoice:', error);
        return NextResponse.json({ error: 'Failed to delete invoice' }, { status: 500 });
    }
}
