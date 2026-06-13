import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/projects/payment-vouchers?projectId=xxx - List payment vouchers
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const projectId = searchParams.get('projectId');

        if (!projectId) {
            return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
        }

        const vouchers = await prisma.paymentVoucher.findMany({
            where: { projectId },
            include: {
                invoice: {
                    select: { invoiceNumber: true, title: true, totalAmount: true }
                }
            },
            orderBy: { createdAt: 'desc' },
        });

        return NextResponse.json(vouchers);
    } catch (error: any) {
        console.error('Error fetching payment vouchers:', error);
        return NextResponse.json({ error: 'Failed to fetch payment vouchers' }, { status: 500 });
    }
}

// POST /api/projects/payment-vouchers - Create a new payment voucher
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const {
            projectId, title, description, type, payeeName, payeeId,
            invoiceId, amount, paymentDate, paymentMethod, bankName,
            bankBranch, accountNumber, chequeNumber, referenceNumber,
            taxWithheld, retentionAmount, retentionReleaseId, notes, createdById,
        } = body;

        if (!projectId || !title || !payeeName || !amount) {
            return NextResponse.json(
                { error: 'projectId, title, payeeName, and amount are required' },
                { status: 400 }
            );
        }

        // Auto-generate PV number
        const lastPV = await prisma.paymentVoucher.findFirst({
            orderBy: { pvNumber: 'desc' },
            select: { pvNumber: true },
        });

        let nextNumber: string;
        if (lastPV && lastPV.pvNumber) {
            const lastNum = parseInt(lastPV.pvNumber.replace('PV-', ''), 10);
            const nextNum = isNaN(lastNum) ? 1 : lastNum + 1;
            nextNumber = 'PV-' + String(nextNum).padStart(5, '0');
        } else {
            nextNumber = 'PV-00001';
        }

        const tax = taxWithheld || 0;
        const retention = retentionAmount || 0;
        const netAmount = amount - tax - retention;

        const voucher = await prisma.paymentVoucher.create({
            data: {
                pvNumber: nextNumber,
                projectId,
                title,
                description: description || null,
                type: type || 'CONTRACTOR',
                payeeName,
                payeeId: payeeId || null,
                invoiceId: invoiceId || null,
                amount,
                paymentDate: paymentDate ? new Date(paymentDate) : null,
                paymentMethod: paymentMethod || null,
                bankName: bankName || null,
                bankBranch: bankBranch || null,
                accountNumber: accountNumber || null,
                chequeNumber: chequeNumber || null,
                referenceNumber: referenceNumber || null,
                taxWithheld: tax,
                retentionAmount: retention,
                netAmount,
                retentionReleaseId: retentionReleaseId || null,
                notes: notes || null,
                createdById: createdById || null,
                status: 'DRAFT',
            },
            include: { invoice: true },
        });

        return NextResponse.json(voucher, { status: 201 });
    } catch (error: any) {
        console.error('Error creating payment voucher:', error);
        return NextResponse.json({ error: 'Failed to create payment voucher' }, { status: 500 });
    }
}

// PATCH /api/projects/payment-vouchers - Update PV status
export async function PATCH(request: NextRequest) {
    try {
        const body = await request.json();
        const {
            id, status, approvedById, paidById, paidAt,
            paymentMethod, bankName, bankBranch, accountNumber,
            chequeNumber, rejectionReason, cancelledReason,
        } = body;

        if (!id || !status) {
            return NextResponse.json({ error: 'id and status are required' }, { status: 400 });
        }

        const voucher = await prisma.$transaction(async (tx) => {
            const existing = await tx.paymentVoucher.findUnique({ where: { id } });
            if (!existing) {
                throw new Error('Payment voucher not found');
            }

            const updateData: any = { status };

            switch (status) {
                case 'APPROVED':
                    if (!approvedById) {
                        throw new Error('approvedById is required');
                    }
                    updateData.approvedById = approvedById;
                    updateData.approvedAt = new Date();
                    break;
                case 'PAID':
                    updateData.paidById = paidById || null;
                    updateData.paidAt = paidAt ? new Date(paidAt) : new Date();
                    if (paymentMethod) updateData.paymentMethod = paymentMethod;
                    if (bankName) updateData.bankName = bankName;
                    if (bankBranch) updateData.bankBranch = bankBranch;
                    if (accountNumber) updateData.accountNumber = accountNumber;
                    if (chequeNumber) updateData.chequeNumber = chequeNumber;
                    break;
                case 'REJECTED':
                    updateData.rejectionReason = rejectionReason || 'Rejected';
                    break;
                case 'CANCELLED':
                    updateData.cancelledReason = cancelledReason || 'Cancelled';
                    break;
                default:
                    break;
            }

            const updatedVoucher = await tx.paymentVoucher.update({
                where: { id },
                data: updateData,
                include: { invoice: true },
            });

            // If status is PAID and linked to an invoice, update invoice paidAmount
            if (status === 'PAID' && existing.invoiceId) {
                const invoice = await tx.projectInvoice.findUnique({
                    where: { id: existing.invoiceId }
                });
                if (invoice) {
                    const newPaidAmount = (invoice.paidAmount || 0) + existing.amount;
                    const newBalance = invoice.totalAmount - newPaidAmount;
                    await tx.projectInvoice.update({
                        where: { id: existing.invoiceId },
                        data: {
                            paidAmount: newPaidAmount,
                            balanceAmount: Math.max(0, newBalance),
                            status: newBalance <= 0 ? 'FULLY_PAID' : 'PARTIALLY_PAID',
                        },
                    });
                }
            }

            return updatedVoucher;
        });

        return NextResponse.json(voucher);
    } catch (error: any) {
        console.error('Error updating payment voucher:', error);
        if (error.message === 'Payment voucher not found') {
            return NextResponse.json({ error: 'Payment voucher not found' }, { status: 404 });
        }
        if (error.message === 'approvedById is required') {
            return NextResponse.json({ error: 'approvedById is required' }, { status: 400 });
        }
        return NextResponse.json({ error: 'Failed to update payment voucher' }, { status: 500 });
    }
}

// DELETE /api/projects/payment-vouchers - Delete DRAFT only
export async function DELETE(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'id is required' }, { status: 400 });
        }

        const existing = await prisma.paymentVoucher.findUnique({ where: { id } });
        if (!existing) {
            return NextResponse.json({ error: 'Payment voucher not found' }, { status: 404 });
        }

        if (existing.status !== 'DRAFT') {
            return NextResponse.json(
                { error: 'Only DRAFT payment vouchers can be deleted' },
                { status: 400 }
            );
        }

        await prisma.paymentVoucher.delete({ where: { id } });
        return NextResponse.json({ message: 'Payment voucher deleted successfully' });
    } catch (error: any) {
        console.error('Error deleting payment voucher:', error);
        return NextResponse.json({ error: 'Failed to delete payment voucher' }, { status: 500 });
    }
}
