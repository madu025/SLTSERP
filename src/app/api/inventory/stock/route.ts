import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const storeId = searchParams.get('storeId');

        if (!storeId) {
            return NextResponse.json({ error: 'Store ID is required' }, { status: 400 });
        }

        const stock = await prisma.inventoryStock.findMany({
            where: { storeId },
            include: {
                item: true
            },
            orderBy: { item: { code: 'asc' } }
        });

        return NextResponse.json(stock);
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch stock' }, { status: 500 });
    }
}
// POST: Bulk Update / Initialize Stock
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { storeId, items, reason, userId } = body;
        // items: [{ itemId, quantity }] - 'quantity' is the NEW physical count (Absolute value)

        if (!storeId || !Array.isArray(items)) {
            return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
        }

        const result = await prisma.$transaction(async (tx) => {
            const transactionItems = [];

            for (const item of items) {
                const newQty = parseFloat(item.quantity);
                if (isNaN(newQty)) continue;

                // Get current stock
                const currentStock = await tx.inventoryStock.findUnique({
                    where: { storeId_itemId: { storeId, itemId: item.itemId } }
                });

                const oldQty = currentStock ? currentStock.quantity : 0;
                const diff = newQty - oldQty;

                if (diff === 0) continue; // No change

                // Update Stock
                await tx.inventoryStock.upsert({
                    where: { storeId_itemId: { storeId, itemId: item.itemId } },
                    update: { quantity: newQty },
                    create: { storeId, itemId: item.itemId, quantity: newQty }
                });

                transactionItems.push({
                    itemId: item.itemId,
                    quantity: diff, // Log the difference (positive or negative)
                    beforeQty: oldQty,
                    afterQty: newQty
                });
            }

            if (transactionItems.length > 0) {
                // Create Transaction Log
                await tx.inventoryTransaction.create({
                    data: {
                        type: 'ADJUSTMENT', // or INITIAL_STOCK
                        storeId,
                        userId: userId || 'SYSTEM',
                        referenceId: `INIT-STOCK-${Date.now()}`,
                        notes: reason || 'Initial Stock Setup',
                        items: {
                            create: transactionItems.map(ti => ({
                                itemId: ti.itemId,
                                quantity: ti.quantity,
                                beforeQty: ti.beforeQty,
                                afterQty: ti.afterQty
                            }))
                        }
                    }
                });
            }

            return transactionItems.length;
        });

        return NextResponse.json({ message: 'Stock updated successfully', itemsUpdated: result });

    } catch (error) {
        console.error("Stock Update Error:", error);
        return NextResponse.json({ error: 'Failed to update stock' }, { status: 500 });
    }
}
