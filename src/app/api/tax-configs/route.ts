import { NextResponse } from 'next/server';
import { TaxConfigService } from '@/services/tax-config.service';
import { TaxTypeEnum } from '@prisma/client';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const status = searchParams.get('status') || 'ACTIVE';

        const taxConfigs = await TaxConfigService.getTaxConfigs(status);

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
        const taxConfig = await TaxConfigService.createTaxConfig(body);

        return NextResponse.json({ success: true, data: taxConfig }, { status: 201 });
    } catch (error: any) {
        const message = error.message;
        if (message === 'MISSING_REQUIRED_FIELDS') {
            return NextResponse.json({
                success: false,
                error: { code: 'VALIDATION_ERROR', message: 'Missing required fields: tax_name, tax_type, tax_rate_percent, effective_from_date' },
            }, { status: 400 });
        }
        if (message === 'INVALID_TAX_TYPE') {
            return NextResponse.json({
                success: false,
                error: { code: 'VALIDATION_ERROR', message: 'Invalid tax_type. Must be one of: ' + Object.values(TaxTypeEnum).join(', ') },
            }, { status: 400 });
        }
        return NextResponse.json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } }, { status: 500 });
    }
}
