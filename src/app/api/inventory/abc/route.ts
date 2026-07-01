import { NextResponse } from 'next/server';
import { InventoryService } from '@/services/inventory';

export async function GET() {
    try {
        const report = await InventoryService.generateAbcReport();
        return NextResponse.json({
            success: true,
            data: report
        });
    } catch (err: any) {
        return NextResponse.json({
            success: false,
            error: err.message || String(err)
        }, { status: 500 });
    }
}
