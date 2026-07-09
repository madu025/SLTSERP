import { NextResponse } from 'next/server';
import { BOMInvoiceService } from '@/services/finance/bom-invoice.service';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { rows, bomPath } = body;

        if (!rows || !Array.isArray(rows) || rows.length === 0) {
            return NextResponse.json(
                { success: false, message: 'Invalid payload: rows must be a non-empty array' },
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

        const result = await BOMInvoiceService.processBOMImport(rows, userId, bomPath);

        return NextResponse.json(result);
    } catch (error: unknown) {
        console.error('BOM Invoice Import Error:', error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        return NextResponse.json(
            { success: false, message: 'Failed to import BOM sheet', error: errorMessage },
            { status: 500 }
        );
    }
}
