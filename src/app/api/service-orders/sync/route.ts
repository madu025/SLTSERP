import { NextResponse } from 'next/server';
import { ServiceOrderService } from '@/services/sod.service';

// POST - Sync service orders from SLT API
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { rtomId, opmcId, rtom } = body;
        const targetId = rtomId || opmcId;

        const result = await ServiceOrderService.syncServiceOrders(targetId, rtom);

        return NextResponse.json(result);

    } catch (error) {
        const err = error as Error;
        if (err.message === 'RTOM_AND_ID_REQUIRED') {
            return NextResponse.json({
                message: 'RTOM selection is required'
            }, { status: 400 });
        }

        console.error('Error syncing service orders:', err);
        return NextResponse.json({
            message: 'Error syncing service orders',
            error: err.message || 'Unknown error'
        }, { status: 500 });
    }
}
