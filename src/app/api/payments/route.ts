/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import PaymentService from '@/services/PaymentService';
import { PaymentTypeEnum, PaymentStatusEnum } from '@prisma/client';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const payment_type = searchParams.get('payment_type');
        const status = searchParams.get('status');
        const invoice_id = searchParams.get('invoice_id');
        const from_date = searchParams.get('from_date');
        const to_date = searchParams.get('to_date');
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '20');

        const filters: any = {};
        if (payment_type) filters.payment_type = payment_type as PaymentTypeEnum;
        if (status) filters.status = status as PaymentStatusEnum;
        if (invoice_id) filters.invoice_id = invoice_id;
        if (from_date) filters.from_date = new Date(from_date);
        if (to_date) filters.to_date = new Date(to_date);
        filters.page = page;
        filters.limit = limit;

        const { data, total } = await PaymentService.listPayments(filters);

        return NextResponse.json({
            success: true,
            data,
            meta: { total, page, limit, pages: Math.ceil(total / limit) },
        });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { invoice_id, payment_type, reference_id, base_amount, tax_config_id, payment_method, payment_ref_number, due_date } = body;

        if (!invoice_id || !payment_type || !reference_id || base_amount === undefined || base_amount === null || !payment_method || !due_date) {
            return NextResponse.json({
                success: false,
                error: { code: 'VALIDATION_ERROR', message: 'Missing required fields: invoice_id, payment_type, reference_id, base_amount, payment_method, due_date' },
            }, { status: 400 });
        }

        // Check if invoice exists
        const invoice = await prisma.vMInvoice.findUnique({ where: { id: invoice_id } });
        if (!invoice) {
            return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Invoice not found' } }, { status: 404 });
        }

        const payment = await PaymentService.createPayment({
            invoice_id,
            payment_type,
            reference_id,
            base_amount: parseFloat(base_amount),
            tax_config_id: tax_config_id || undefined,
            payment_method,
            payment_ref_number: payment_ref_number || undefined,
            due_date: new Date(due_date),
        });

        return NextResponse.json({ success: true, data: payment }, { status: 201 });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } }, { status: 500 });
    }
}

