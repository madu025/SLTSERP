import { NextResponse } from 'next/server';
import { BOMInvoiceService } from '@/services/finance/bom-invoice.service';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { csvText } = body;

        if (!csvText || typeof csvText !== 'string') {
            return NextResponse.json(
                { success: false, message: 'Invalid payload: csvText must be a non-empty string' },
                { status: 400 }
            );
        }

        // Fetch auth headers
        const userId = request.headers.get('x-user-id') || 'ADMIN';
        const userRole = request.headers.get('x-user-role');

        if (userRole === 'AREA_COORDINATOR' || userRole === 'QC_OFFICER') {
            return NextResponse.json(
                { success: false, message: 'Permission Denied: Unauthorized to import BOM invoices.' },
                { status: 403 }
            );
        }

        const result = await BOMInvoiceService.processBOMCSVImport(csvText, userId);

        return NextResponse.json(result);
    } catch (error: unknown) {
        console.error('BOM CSV Import Error:', error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        return NextResponse.json(
            { success: false, message: 'Failed to import BOM CSV sheet', error: errorMessage },
            { status: 500 }
        );
    }
}
