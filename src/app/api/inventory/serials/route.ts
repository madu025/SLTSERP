import { NextResponse } from 'next/server';
import { InventoryService } from '@/services/inventory.service';
import { handleApiError } from '@/lib/api-utils';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const storeId = searchParams.get('storeId');
        const itemId = searchParams.get('itemId');
        const search = searchParams.get('search');
        const staffId = searchParams.get('staffId');

        if (!storeId && !itemId) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const where: any = {};
            if (search) {
                where.serialNumber = { contains: search, mode: 'insensitive' };
            }
            if (staffId) {
                where.assignedStaffId = staffId;
            }

            const serials = await prisma.inventoryItemSerial.findMany({
                where,
                include: {
                    item: true,
                    store: true,
                    assignedStaff: true
                },
                orderBy: { updatedAt: 'desc' },
                take: 100
            });
            return NextResponse.json(serials);
        }

        if (!storeId || !itemId) {
            return NextResponse.json({ error: 'MISSING_PARAMS' }, { status: 400 });
        }

        const serials = await InventoryService.getItemSerials(storeId, itemId);

        return NextResponse.json(serials);
    } catch (error) {
        return handleApiError(error);
    }
}
