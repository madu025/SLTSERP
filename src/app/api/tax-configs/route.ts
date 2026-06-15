/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { TaxTypeEnum } from '@prisma/client';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const status = searchParams.get('status') || 'ACTIVE';

        const where: any = {
            status,
        };

        const taxConfigs = await prisma.vMTaxConfig.findMany({
            where,
            orderBy: { effective_from_date: 'desc' },
        });

        return NextResponse.json({
            success: true,
            data: taxConfigs,
        });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { tax_name, tax_type, tax_rate_percent, effective_from_date, effective_to_date, applicable_to, tax_inclusive, tax_exempt_items, status } = body;

        if (!tax_name || !tax_type || tax_rate_percent === undefined || tax_rate_percent === null || !effective_from_date) {
            return NextResponse.json({
                success: false,
                error: { code: 'VALIDATION_ERROR', message: 'Missing required fields: tax_name, tax_type, tax_rate_percent, effective_from_date' },
            }, { status: 400 });
        }

        if (!Object.values(TaxTypeEnum).includes(tax_type)) {
            return NextResponse.json({
                success: false,
                error: { code: 'VALIDATION_ERROR', message: 'Invalid tax_type. Must be one of: ' + Object.values(TaxTypeEnum).join(', ') },
            }, { status: 400 });
        }

        const taxConfig = await prisma.vMTaxConfig.create({
            data: {
                tax_name,
                tax_type: tax_type as TaxTypeEnum,
                tax_rate_percent: parseFloat(tax_rate_percent),
                effective_from_date: new Date(effective_from_date),
                effective_to_date: effective_to_date ? new Date(effective_to_date) : null,
                applicable_to: applicable_to ? JSON.stringify(applicable_to) : '[]',
                tax_inclusive: tax_inclusive || false,
                tax_exempt_items: tax_exempt_items || null,
                status: status || 'ACTIVE',
            },
        });

        return NextResponse.json({ success: true, data: taxConfig }, { status: 201 });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } }, { status: 500 });
    }
}
