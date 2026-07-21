import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ServiceOrderService } from '@/services/sod.service';

export async function GET(req: Request) {
    try {
        const raw = await prisma.extensionRawData.findFirst({
            where: { soNum: 'HAV202607170008702' }
        });
        if (!raw) return NextResponse.json({ error: 'No raw data' });

        await ServiceOrderService.bridgeSync(raw.scrapedData as any);
        
        const so = await prisma.serviceOrder.findUnique({
            where: { soNum: 'HAV202607170008702' },
            select: { dropWireDistance: true, ontSerialNumber: true, teamId: true }
        });

        return NextResponse.json({ success: true, so });
    } catch (e: any) {
        return NextResponse.json({ success: false, error: e.message, stack: e.stack });
    }
}
