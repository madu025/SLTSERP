import { NextResponse } from 'next/server';
import { ServiceOrderService } from '@/services/sod.service';

// POST - Sync service orders from SLT API
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { opmcId, rtom } = body;

        const result = await ServiceOrderService.syncServiceOrders(opmcId, rtom);

        return NextResponse.json(result);

    } catch (error: any) {
        if (error.message === 'OPMC_ID_AND_RTOM_REQUIRED') {
            return NextResponse.json({
                message: 'OPMC ID and RTOM are required'
            }, { status: 400 });
        }

        console.error('Error syncing service orders:', error);
        return NextResponse.json({
            message: 'Error syncing service orders',
            error: error.message || 'Unknown error'
        }, { status: 500 });
    }
}
