import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const itemId = searchParams.get('itemId');
        const storeId = searchParams.get('storeId');
        const type = searchParams.get('type');
        const startDate = searchParams.get('startDate');
        const endDate = searchParams.get('endDate');

        const where: any = {};

        if (storeId) {
            where.storeId = storeId;
        }

        if (type) {
            where.type = type; // GRN_IN, TRANSFER_OUT, etc.
        }

        if (itemId) {
            // Filter transactions that strictly contain this item
            where.items = {
                some: {
                    itemId: itemId
                }
            };
        }

        if (startDate && endDate) {
            where.createdAt = {
                gte: new Date(startDate),
                lte: new Date(endDate)
            };
        }

        const transactions = await prisma.inventoryTransaction.findMany({
            where,
            include: {
                store: { select: { name: true, type: true } },
                user: { select: { name: true } },
                items: {
                    include: {
                        item: { select: { code: true, name: true, unit: true } }
                    }
                },
            },
            orderBy: { createdAt: 'desc' }
        });

        // Post-process to flatten if searching for a specific item, or return detailed list
        // If itemId is present, we might want to filter the 'items' array in the response to only show that item's movement,
        // but usually seeing the whole transaction context is good.

        return NextResponse.json(transactions);
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 });
    }
}
