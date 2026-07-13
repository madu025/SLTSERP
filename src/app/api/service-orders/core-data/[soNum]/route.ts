import { NextResponse } from 'next/server';
import { ServiceOrderService } from '@/services/sod.service';

export const dynamic = 'force-dynamic';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ soNum: string }> }
) {
    try {
        const { soNum } = await params;

        const serviceOrder = await ServiceOrderService.getServiceOrderBySoNum(soNum);

        if (!serviceOrder) {
            return NextResponse.json({ success: false, message: 'Not found' }, { status: 404 });
        }

        return NextResponse.json({ success: true, data: serviceOrder });
    } catch (error) {
        console.error('Error fetching core SO data:', error);
        return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
}
