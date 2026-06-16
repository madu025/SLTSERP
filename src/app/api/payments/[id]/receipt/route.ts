/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import PaymentService from '@/services/PaymentService';
import { prisma } from '@/lib/prisma';

export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const { payment_received_date, payment_ref_number } = await request.json();

        if (!payment_received_date) {
            return NextResponse.json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Missing payment_received_date' } }, { status: 400 });
        }

        const existingPayment = await prisma.vMPayment.findUnique({
            where: { id },
        });

        if (!existingPayment) {
            return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Payment not found' } }, { status: 404 });
        }

        if (existingPayment.status === 'COMPLETED') {
            return NextResponse.json({ success: false, error: { code: 'ALREADY_COMPLETED', message: 'Payment is already completed' } }, { status: 409 });
        }

        const payment = await PaymentService.recordPaymentReceipt(
            id,
            existingPayment.total_amount,
            new Date(payment_received_date),
            payment_ref_number
        );

        return NextResponse.json({ success: true, data: payment });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } }, { status: 500 });
    }
}

