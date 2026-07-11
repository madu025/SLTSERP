import { NextResponse } from 'next/server';
import { BOMInvoiceService } from '@/services/finance/bom-invoice.service';

export async function OPTIONS() {
    return new NextResponse(null, {
        status: 204,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, x-user-id, x-user-role, x-extension-key',
        },
    });
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { csvText, bomPath } = body;

        if (!csvText || typeof csvText !== 'string') {
            return NextResponse.json(
                { success: false, message: 'Invalid payload: csvText must be a non-empty string' },
                { status: 400, headers: { 'Access-Control-Allow-Origin': '*' } }
            );
        }

        // Fetch auth headers
        const extensionKey = request.headers.get('x-extension-key');
        const extensionSecret = process.env.EXTENSION_SECRET || 'slt-bridge-secret-2026';
        const isExtension = extensionKey === extensionSecret;

        const userId = request.headers.get('x-user-id') || 'ADMIN';
        const userRole = request.headers.get('x-user-role');

        if (!isExtension && (userRole === 'AREA_COORDINATOR' || userRole === 'QC_OFFICER')) {
            return NextResponse.json(
                { success: false, message: 'Permission Denied: Unauthorized to import BOM invoices.' },
                { status: 403, headers: { 'Access-Control-Allow-Origin': '*' } }
            );
        }

        const result = await BOMInvoiceService.processBOMCSVImport(csvText, userId, bomPath);

        return NextResponse.json(result, {
            headers: {
                'Access-Control-Allow-Origin': '*',
            }
        });
    } catch (error: unknown) {
        console.error('BOM CSV Import Error:', error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        return NextResponse.json(
            { success: false, message: 'Failed to import BOM CSV sheet', error: errorMessage },
            { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } }
        );
    }
}
