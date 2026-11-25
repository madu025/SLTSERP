import { NextResponse } from 'next/server';
import { PublicInvoiceService } from '@/services/invoice/public.invoice.service';
import { AppError } from '@/lib/error';

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
        // A wrong or unknown id is a plain 404 with a fixed message (no database error text for an anonymous caller)
        if (error instanceof AppError && error.statusCode === 404) {
            return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
        }
        console.error('[PUBLIC_INVOICE_API_ERROR]', error);
        return NextResponse.json({ error: 'Failed to fetch public invoice details' }, { status: 500 });
    }
}
