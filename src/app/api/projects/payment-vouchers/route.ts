import { NextRequest, NextResponse } from 'next/server';
import { PaymentVoucherService } from '@/services/payment-voucher.service';

// GET /api/projects/payment-vouchers?projectId=xxx - List payment vouchers
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const projectId = searchParams.get('projectId');

        if (!projectId) {
            return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
        }

        const vouchers = await PaymentVoucherService.getVouchers(projectId);
        return NextResponse.json(vouchers);
    } catch (error: unknown) {
        console.error('Error fetching payment vouchers:', error);
        return NextResponse.json({ error: 'Failed to fetch payment vouchers' }, { status: 500 });
    }
}

// POST /api/projects/payment-vouchers - Create a new payment voucher
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { projectId, title, payeeName, amount } = body;

        if (!projectId || !title || !payeeName || !amount) {
            return NextResponse.json(
                { error: 'projectId, title, payeeName, and amount are required' },
                { status: 400 }
            );
        }

        const voucher = await PaymentVoucherService.createVoucher(body);
        return NextResponse.json(voucher, { status: 201 });
    } catch (error: unknown) {
        console.error('Error creating payment voucher:', error);
        return NextResponse.json({ error: 'Failed to create payment voucher' }, { status: 500 });
    }
}

// PATCH /api/projects/payment-vouchers - Update PV status
export async function PATCH(request: NextRequest) {
    try {
        const body = await request.json();
        const { id, status, ...options } = body;

        if (!id || !status) {
            return NextResponse.json({ error: 'id and status are required' }, { status: 400 });
        }

        const voucher = await PaymentVoucherService.updateVoucherStatus(id, status, options);
        return NextResponse.json(voucher);
    } catch (error: unknown) {
        console.error('Error updating payment voucher:', error);
        const errorMsg = error instanceof Error ? error.message : '';
        if (errorMsg === 'PAYMENT_VOUCHER_NOT_FOUND') {
            return NextResponse.json({ error: 'Payment voucher not found' }, { status: 404 });
        }
        if (errorMsg === 'APPROVED_BY_ID_REQUIRED') {
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

        await PaymentVoucherService.deleteVoucher(id);
        return NextResponse.json({ message: 'Payment voucher deleted successfully' });
    } catch (error: unknown) {
        console.error('Error deleting payment voucher:', error);
        const errorMsg = error instanceof Error ? error.message : '';
        if (errorMsg === 'PAYMENT_VOUCHER_NOT_FOUND') {
            return NextResponse.json({ error: 'Payment voucher not found' }, { status: 404 });
        }
        if (errorMsg === 'DRAFT_ONLY_DELETION') {
            return NextResponse.json(
                { error: 'Only DRAFT payment vouchers can be deleted' },
                { status: 400 }
            );
        }
        return NextResponse.json({ error: 'Failed to delete payment voucher' }, { status: 500 });
    }
}
