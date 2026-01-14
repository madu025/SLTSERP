import { NextResponse } from 'next/server';
import { InvoiceService } from '@/services/invoice.service';
import { getServerSession } from 'next-auth'; // Assuming authentication
// If you implement proper auth, import options. For now skipping strict auth for MVP speed/context

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { contractorId, month, year } = body;

        if (!contractorId || !month || !year) {
            return NextResponse.json({ success: false, message: 'Missing required fields' }, { status: 400 });
        }

        // Dummy user ID for now or from session
        const userId = 'ADMIN';

        const result = await InvoiceService.generateMonthlyInvoice(contractorId, parseInt(month), parseInt(year), userId);

        if (!result.success) {
            return NextResponse.json(result, { status: 400 });
        }

        return NextResponse.json(result);
    } catch (error) {
        console.error('Invoice Generation Error:', error);
        return NextResponse.json({ success: false, message: 'Internal Server Error', error: (error as any).message }, { status: 500 });
    }
}
