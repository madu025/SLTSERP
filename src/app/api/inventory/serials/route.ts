import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { handleApiError } from '@/lib/api-utils';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const storeId = searchParams.get('storeId');
        const itemId = searchParams.get('itemId');

        if (!storeId || !itemId) {
            return NextResponse.json({ error: 'MISSING_PARAMS' }, { status: 400 });
        }

        const serials = await prisma.inventoryItemSerial.findMany({
            where: {
                storeId,
                itemId,
                status: 'IN_STORE'
            },
            orderBy: { serialNumber: 'asc' }
        });

        return NextResponse.json(serials);
    } catch (error) {
        return handleApiError(error);
    }
}
