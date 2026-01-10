import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { storeId, contractorId, month, description, reason, items } = body;
        // items: [{ itemId, quantity }]

        // SCENARIO 1: Contractor Wastage (No Store Stock Reduction)
        if (contractorId) {
            const wastage = await (prisma as any).contractorWastage.create({
                data: {
                    contractorId,
                    storeId,
                    month: month || new Date().toISOString().slice(0, 7),
                    description: description || reason,
                    items: {
                        create: items.map((item: any) => ({
                            itemId: item.itemId,
                            quantity: parseFloat(item.quantity),
                            unit: item.unit || 'Nos'
                        }))
                    }
                }
            });
            return NextResponse.json({ message: 'Contractor wastage recorded', id: wastage.id });
        }

        const userId = request.headers.get('x-user-id') || 'SYSTEM';

        // SCENARIO 2: Store Wastage (Existing Logic - Reduce Stock)
        const result = await prisma.$transaction(async (tx) => {
            const transactionItems = [];

            for (const item of items) {
                const qty = parseFloat(item.quantity);
                if (qty <= 0) continue;

                // Reduce Stock
                await tx.inventoryStock.upsert({
                    where: { storeId_itemId: { storeId, itemId: item.itemId } },
                    update: { quantity: { decrement: qty } },
                    create: { storeId, itemId: item.itemId, quantity: -qty } // Should not happen usually
                });

                transactionItems.push({ itemId: item.itemId, quantity: -qty }); // Negative for reduce
            }

            // Create Transaction Log
            const txRecord = await tx.inventoryTransaction.create({
                data: {
                    type: 'WASTAGE',
                    storeId,
                    userId, // Added userId
                    referenceId: `STORE-WASTAGE-${Date.now()}`, // Optional
                    notes: reason || description,
                    items: {
                        create: transactionItems.map(ti => ({
                            itemId: ti.itemId,
                            quantity: ti.quantity,
                            beforeQty: 0, afterQty: 0 // Placeholder
                        }))
                    }
                }
            });

            return txRecord;
        });

        return NextResponse.json(result);

    } catch (error) {
        console.error("Wastage Error:", error);
        return NextResponse.json({ error: 'Failed to record wastage' }, { status: 500 });
    }
}
