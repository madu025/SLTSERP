import { NextResponse } from 'next/server';
import { ServiceOrderService } from '@/services/sod.service';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { rows } = body;

        if (!rows || !Array.isArray(rows)) {
            return NextResponse.json({ message: 'Invalid data format' }, { status: 400 });
        }

        const result = await ServiceOrderService.bulkImportServiceOrders(rows);
        return NextResponse.json({
            message: `Import completed: ${result.created} succeeded, ${result.failed} failed`,
            ...result
        });
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error('Error in bulk import API:', error);
        return NextResponse.json({ message: 'Error in bulk import', debug: msg }, { status: 500 });
    }
}
