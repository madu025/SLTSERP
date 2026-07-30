import { NextResponse } from 'next/server';
import { PublicInvoiceService } from '@/services/invoice/public.invoice.service';

export const dynamic = 'force-dynamic';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        if (!id) {
            return NextResponse.json({ error: 'Invoice ID is required' }, { status: 400 });
        }

        const responseData = await PublicInvoiceService.getPublicInvoiceDetails(id);
        
        return NextResponse.json({ success: true, data: responseData });
    } catch (error: unknown) {
        console.error('[PUBLIC_INVOICE_API_ERROR]', error);
        const details = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json({ error: 'Failed to fetch public invoice details', details }, { status: 500 });
    }
}
