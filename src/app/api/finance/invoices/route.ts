import { NextResponse } from 'next/server';
import { InvoiceService } from '@/services/finance/invoice.service';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    try {
        const url = new URL(req.url);
        const page = parseInt(url.searchParams.get('page') || '1');
        const limit = parseInt(url.searchParams.get('limit') || '10');
        const search = url.searchParams.get('search') || '';
        const approvalStatus = url.searchParams.get('approvalStatus') || '';
        
        const data = await InvoiceService.getInvoices({ page, limit, search, approvalStatus });

        return NextResponse.json({
            success: true,
            data
        });
    } catch (error: any) {
        console.error('Fetch invoices error:', error);
        return NextResponse.json(
            { success: false, error: { message: error.message || 'Internal Server Error' } },
            { status: 500 }
        );
    }
}
