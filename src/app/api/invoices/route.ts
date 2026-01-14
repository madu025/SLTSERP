import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET all invoices with filters
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const status = searchParams.get('status');
        const contractorId = searchParams.get('contractorId');
        const projectId = searchParams.get('projectId');

        const where: any = {};

        if (status) where.status = status;
        if (contractorId) where.contractorId = contractorId;
        if (projectId) where.projectId = projectId;

        const invoices = await prisma.invoice.findMany({
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
                }
            },
            orderBy: {
                createdAt: 'desc'
            }
        });

        return NextResponse.json(invoices);
    } catch (error) {
        console.error('Error fetching invoices:', error);
        return NextResponse.json(
            { error: 'Failed to fetch invoices' },
            { status: 500 }
        );
    }
}

// POST create new invoice
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const {
            invoiceNumber,
            contractorId,
            projectId,
            amount,
            description,
            dueDate
        } = body;

        // Validate required fields
        if (!invoiceNumber || !contractorId || !amount) {
            return NextResponse.json(
                { error: 'Invoice number, contractor, and amount are required' },
                { status: 400 }
            );
        }

        // Check if invoice number already exists
        const existing = await prisma.invoice.findUnique({
            where: { invoiceNumber }
        });

        if (existing) {
            return NextResponse.json(
                { error: 'Invoice number already exists' },
                { status: 400 }
            );
        }

        const invoice = await prisma.invoice.create({
            data: {
                invoiceNumber,
                contractorId,
                projectId: projectId || null,
                amount: parseFloat(amount),
                status: 'PENDING',
                date: new Date(),
                description: description || null,
                dueDate: dueDate ? new Date(dueDate) : null
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

        return NextResponse.json(invoice);
    } catch (error: any) {
        console.error('Error creating invoice:', error);
        if (error.code === 'P2002') {
            return NextResponse.json(
                { error: 'Invoice number already exists' },
                { status: 400 }
            );
        }
        return NextResponse.json(
            { error: 'Failed to create invoice' },
            { status: 500 }
        );
    }
}

// PATCH update invoice status
export async function PATCH(request: Request) {
    try {
        const body = await request.json();
        const { id, status, amount, description } = body;

        if (!id) {
            return NextResponse.json(
                { error: 'Invoice ID required' },
                { status: 400 }
            );
        }

        const updateData: any = {};

        if (status) updateData.status = status;
        if (amount) updateData.amount = parseFloat(amount);
        if (description !== undefined) updateData.description = description;

        const invoice = await prisma.invoice.update({
            where: { id },
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

        return NextResponse.json(invoice);
    } catch (error) {
        console.error('Error updating invoice:', error);
        return NextResponse.json(
            { error: 'Failed to update invoice' },
            { status: 500 }
        );
    }
}

// DELETE invoice
export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json(
                { error: 'Invoice ID required' },
                { status: 400 }
            );
        }

        // Check if invoice can be deleted (only PENDING invoices)
        const invoice = await prisma.invoice.findUnique({
            where: { id }
        });

        if (!invoice) {
            return NextResponse.json(
                { error: 'Invoice not found' },
                { status: 404 }
            );
        }

        if (invoice.status === 'PAID') {
            return NextResponse.json(
                { error: 'Cannot delete paid invoices' },
                { status: 400 }
            );
        }

        await prisma.invoice.delete({
            where: { id }
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting invoice:', error);
        return NextResponse.json(
            { error: 'Failed to delete invoice' },
            { status: 500 }
        );
    }
}
