import { NextResponse } from 'next/server';
import { InventoryService } from '@/services/inventory';

export async function POST() {
    try {
        const results = await InventoryService.updateDynamicSafetyLevels();
        return NextResponse.json({
            success: true,
            message: 'Dynamic Safety Stocks and Reorder Points updated successfully.',
            data: results
        });
    } catch (err: any) {
        return NextResponse.json({
            success: false,
            error: err.message || String(err)
        }, { status: 500 });
    }
}
