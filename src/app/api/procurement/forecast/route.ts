import { NextRequest, NextResponse } from 'next/server';
import { InventoryService } from '@/services/inventory';
import { handleApiError } from '@/lib/api-utils';

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const months = parseInt(searchParams.get('months') || '1', 10);
        const target = parseInt(searchParams.get('target') || '0', 10);

        const forecast = await InventoryService.getMaterialForecast({
            months,
            monthlyConnectionTarget: target
        });

        return NextResponse.json(forecast);
    } catch (error) {
        return handleApiError(error);
    }
}
