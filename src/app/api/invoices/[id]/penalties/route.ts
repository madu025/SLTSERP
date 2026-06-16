import { NextResponse } from 'next/server';
import { prisma, primaryClient } from '@/lib/prisma';
import { InvoiceGeneratorService } from '@/services/invoice/invoice.generator.service';
import { NotificationService } from '@/services/notification';

export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const body = await request.json();
        const { amount, reason, description, serviceOrderId } = body;

        if (!amount || isNaN(parseFloat(amount))) {
            return NextResponse.json({ error: 'Valid penalty amount is required' }, { status: 400 });
        }

        const userRole = request.headers.get('x-user-role');
        const userId = request.headers.get('x-user-id');

        if (!userId) {
            return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
        }

        // Fetch proposer info
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { name: true, role: true }
        });
        const proposerName = user ? `${user.name || 'User'} (${user.role})` : 'System User';

        // Auto approve if proposed by Area Manager or above
        const isApproverRole = userRole === 'AREA_MANAGER' || userRole === 'SUPER_ADMIN' || userRole === 'ADMIN';
        const status = isApproverRole ? 'APPROVED' : 'PENDING';

        const penalty = await primaryClient.$transaction(async (tx) => {
            const record = await tx.penalty.create({
                data: {
                    invoiceId: id,
                    amount: parseFloat(amount),
                    reason: reason || 'MANUAL',
                    description: description || null,
                    serviceOrderId: serviceOrderId || null,
                    status,
                    proposedBy: proposerName
                }
            });

            if (status === 'APPROVED') {
                await InvoiceGeneratorService.recalculateInvoiceSplits(id, tx);
            }

            return record;
        });

        // Get invoice number for notification
        const invoice = await prisma.invoice.findUnique({
            where: { id },
            select: { invoiceNumber: true }
        });
        const invNum = invoice?.invoiceNumber || id;

        // Notify Area Managers if PENDING
        if (status === 'PENDING') {
            await NotificationService.notifyByRole({
                roles: ['AREA_MANAGER', 'SUPER_ADMIN', 'ADMIN'],
                title: 'New Penalty Proposed',
                message: `A penalty of LKR ${parseFloat(amount).toFixed(2)} has been proposed for Invoice ${invNum} by ${proposerName}. Reason: ${reason || 'MANUAL'}.`,
                type: 'FINANCE',
                priority: 'HIGH',
                link: '/invoices'
            });
        }

        return NextResponse.json({ success: true, penalty });
    } catch (error) {
        console.error('Error creating manual penalty:', error);
        return NextResponse.json({ error: 'Failed to create penalty' }, { status: 500 });
    }
}

export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const body = await request.json();
        const { penaltyId, status } = body; // status can be 'APPROVED' or 'REJECTED'

        if (!penaltyId || !['APPROVED', 'REJECTED'].includes(status)) {
            return NextResponse.json({ error: 'Valid penalty ID and status (APPROVED/REJECTED) are required' }, { status: 400 });
        }

        // Only Area Manager, Admin, and Super Admin can approve/reject
        const userRole = request.headers.get('x-user-role');
        const isApproverRole = userRole === 'AREA_MANAGER' || userRole === 'SUPER_ADMIN' || userRole === 'ADMIN';

        if (!isApproverRole) {
            return NextResponse.json({ error: 'Permission Denied. Only Area Managers or Admins can approve/reject penalties.' }, { status: 403 });
        }

        const updatedPenalty = await primaryClient.$transaction(async (tx) => {
            const record = await tx.penalty.update({
                where: { id: penaltyId },
                data: { status }
            });

            await InvoiceGeneratorService.recalculateInvoiceSplits(id, tx);
            return record;
        });

        // Notify about decision
        const invoice = await prisma.invoice.findUnique({
            where: { id },
            select: { invoiceNumber: true }
        });
        const invNum = invoice?.invoiceNumber || id;

        await NotificationService.notifyByRole({
            roles: ['AREA_COORDINATOR', 'QC_OFFICER', 'MANAGER', 'OSP_MANAGER', 'SUPER_ADMIN', 'ADMIN'],
            title: `Penalty ${status.toLowerCase()}`,
            message: `A proposed penalty of LKR ${updatedPenalty.amount.toFixed(2)} for Invoice ${invNum} has been ${status.toLowerCase()} by an Area Manager.`,
            type: 'FINANCE',
            priority: 'MEDIUM',
            link: '/invoices'
        });

        return NextResponse.json({ success: true, penalty: updatedPenalty });
    } catch (error) {
        console.error('Error updating penalty status:', error);
        return NextResponse.json({ error: 'Failed to update penalty status' }, { status: 500 });
    }
}

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const { searchParams } = new URL(request.url);
        const penaltyId = searchParams.get('penaltyId');

        if (!penaltyId) {
            return NextResponse.json({ error: 'Penalty ID is required' }, { status: 400 });
        }

        const userRole = request.headers.get('x-user-role');
        const isApproverRole = userRole === 'AREA_MANAGER' || userRole === 'SUPER_ADMIN' || userRole === 'ADMIN';

        // Check if penalty exists and its status
        const penalty = await primaryClient.penalty.findUnique({
            where: { id: penaltyId }
        });

        if (!penalty) {
            return NextResponse.json({ error: 'Penalty not found' }, { status: 404 });
        }

        // Only allow deletion if user is Area Manager/Admin, or if the penalty is still PENDING
        if (!isApproverRole && penalty.status !== 'PENDING') {
            return NextResponse.json({ error: 'Permission Denied. Only Area Managers can delete approved/rejected penalties.' }, { status: 403 });
        }

        await primaryClient.$transaction(async (tx) => {
            await tx.penalty.delete({
                where: { id: penaltyId }
            });

            await InvoiceGeneratorService.recalculateInvoiceSplits(id, tx);
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting penalty:', error);
        return NextResponse.json({ error: 'Failed to delete penalty' }, { status: 500 });
    }
}
