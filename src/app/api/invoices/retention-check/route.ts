import { NextResponse } from 'next/server';
import { InvoiceService } from '@/services/invoice.service';

export async function POST(request: Request) {
    try {
        console.log('[RETENTION-CHECK] Started');
        const results = await InvoiceService.checkRetentionEligibility();
        return NextResponse.json({ success: true, results });
    } catch (error) {
        console.error('Retention Check Error:', error);
        return NextResponse.json({ success: false, message: 'Internal Server Error', error: (error as any).message }, { status: 500 });
    }
}
