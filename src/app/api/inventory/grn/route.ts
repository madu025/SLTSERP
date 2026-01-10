import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Create a new GRN (Goods Received Note)
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { storeId, sourceType, supplier, receivedById, items } = body;
        // items: [{ itemId, quantity }]

        // Transaction: 
        // 1. Create GRN
        // 2. Update Stock (Upsert)
        // 3. Create Inventory Transaction Log

        const result = await prisma.$transaction(async (tx) => {
            // 1. Create GRN
            const grn = await tx.gRN.create({
                data: {
                    grnNumber: `GRN-${Date.now()}`, // Simple ID generation
                    storeId,
                    sourceType,
                    supplier,
                    receivedById,
                    items: {
                        create: items.map((i: any) => ({
                            itemId: i.itemId,
                            quantity: parseFloat(i.quantity)
                        }))
                    }
                }
            });

            // 2. Update Stock & 3. Create Transaction Items
            const transactionItems = [];

            for (const item of items) {
                const qty = parseFloat(item.quantity);

                // Upsert Stock
                await tx.inventoryStock.upsert({
                    where: {
                        storeId_itemId: {
                            storeId,
                            itemId: item.itemId
                        }
                    },
                    update: {
                        quantity: { increment: qty }
                    },
                    create: {
                        storeId,
                        itemId: item.itemId,
                        quantity: qty
                    }
                });

                transactionItems.push({
                    itemId: item.itemId,
                    quantity: qty
                });
            }

            // 3. Create Transaction Log
            await tx.inventoryTransaction.create({
                data: {
                    type: 'GRN_IN',
                    storeId,
                    referenceId: grn.id,
                    userId: receivedById,
                    notes: `GRN from ${sourceType} ${supplier ? '- ' + supplier : ''}`,
                    items: {
                        create: transactionItems
                    }
                }
            });

            return grn;
        });

        return NextResponse.json(result);

    } catch (error) {
        console.error("GRN Error", error);
        return NextResponse.json({ error: 'Failed to create GRN' }, { status: 500 });
    }
}

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const storeId = searchParams.get('storeId');

        const grns = await prisma.gRN.findMany({
            where: storeId ? { storeId } : {},
            include: {
                store: true,
                receivedBy: true,
                items: {
                    include: { item: true }
                }
            },
            orderBy: { createdAt: 'desc' }
        });
        return NextResponse.json(grns);
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch GRNs' }, { status: 500 });
    }
}
