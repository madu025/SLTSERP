import { NextResponse } from 'next/server';
import { InvoiceService } from '@/services/invoice.service';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { contractorId, month, year } = body;

        if (!contractorId || !month || !year) {
            return NextResponse.json({ success: false, message: 'Missing required fields' }, { status: 400 });
        }

        // Auth Check via Middleware Headers
        const userRole = request.headers.get('x-user-role');
        const userId = request.headers.get('x-user-id') || 'ADMIN';

        if (userRole === 'AREA_COORDINATOR' || userRole === 'QC_OFFICER') {
            return NextResponse.json({ success: false, message: 'Permission Denied: Role not authorized to generate invoices.' }, { status: 403 });
        }

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
