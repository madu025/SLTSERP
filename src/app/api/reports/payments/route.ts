/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { PaymentTypeEnum, PaymentStatusEnum } from '@prisma/client';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const from_date = searchParams.get('from_date');
        const to_date = searchParams.get('to_date');
        const payment_type = searchParams.get('payment_type');
        const status = searchParams.get('status');
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '50');
        const skip = (page - 1) * limit;

        const where: any = {};
        if (payment_type) where.payment_type = payment_type as PaymentTypeEnum;
        if (status) where.status = status as PaymentStatusEnum;
        if (from_date || to_date) {
            where.payment_date = {};
            if (from_date) where.payment_date.gte = new Date(from_date);
            if (to_date) where.payment_date.lte = new Date(to_date);
        }

        const [payments, total] = await Promise.all([
            prisma.vMPayment.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
                include: {
                    invoice: { select: { id: true, invoice_number: true, total_amount: true } },
                },
            }),
            prisma.vMPayment.count({ where }),
        ]);

        const summary = payments.reduce(
            (acc, p) => ({
                total_count: acc.total_count + 1,
                total_base_amount: acc.total_base_amount + p.base_amount,
                total_tax_amount: acc.total_tax_amount + p.tax_amount,
                total_amount: acc.total_amount + p.total_amount,
            }),
            { total_count: 0, total_base_amount: 0, total_tax_amount: 0, total_amount: 0 }
        );

        const byTypeMap = new Map<string, { count: number; total_amount: number }>();
        payments.forEach((p) => {
            const key = p.payment_type;
            const existing = byTypeMap.get(key) || { count: 0, total_amount: 0 };
            existing.count += 1;
            existing.total_amount += p.total_amount;
            byTypeMap.set(key, existing);
        });
        const by_type = Array.from(byTypeMap.entries()).map(([payment_type, data]) => ({
            payment_type,
            ...data,
        }));

        return NextResponse.json({
            success: true,
            data: {
                summary,
                by_type,
                payments,
            },
            meta: { total, page, limit, pages: Math.ceil(total / limit) },
        });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } }, { status: 500 });
    }
}
