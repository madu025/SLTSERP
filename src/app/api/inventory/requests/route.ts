import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Helper to generate Request ID
const generateRequestId = () => `REQ-${Date.now().toString().slice(-6)}`;

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { fromStoreId, toStoreId, requestedById, items } = body;
        // items: [{ itemId, requestedQty }]

        const req = await prisma.stockRequest.create({
            data: {
                requestNr: generateRequestId(),
                fromStoreId, // Requesting Store
                toStoreId,   // Main Store
                requestedById,
                status: 'PENDING',
                items: {
                    create: items.map((i: any) => ({
                        itemId: i.itemId,
                        requestedQty: parseFloat(i.requestedQty)
                    }))
                }
            }
        });

        return NextResponse.json(req);

    } catch (error) {
        return NextResponse.json({ error: 'Failed to create request' }, { status: 500 });
    }
}

// Approve / Reject / Allocate
export async function PATCH(request: Request) {
    try {
        const body = await request.json();
        const { requestId, action, approvedById, allocation } = body;
        // allocation: [{ itemId, approvedQty }] - only if action === 'APPROVE'

        if (action === 'REJECT') {
            const updated = await prisma.stockRequest.update({
                where: { id: requestId },
                data: { status: 'REJECTED', approvedById }
            });
            return NextResponse.json(updated);
        }

        if (action === 'APPROVE') {
            // Transaction:
            // 1. Update Request Status & Approved Quantities
            // 2. Reduce Stock from Main Store (toStoreId)
            // 3. Add Stock to Branch Store (fromStoreId) - Immediate Transfer
            // 4. Log Transaction (TRANSFER_OUT from Main, TRANSFER_IN to Branch)

            const result = await prisma.$transaction(async (tx) => {
                // Fetch request details first to get store IDs
                const stockReq = await tx.stockRequest.findUnique({
                    where: { id: requestId },
                    include: { items: true }
                });

                if (!stockReq) throw new Error("Request not found");

                // 1. Update Request
                // First update items with approved qty
                for (const alloc of allocation) {
                    await tx.stockRequestItem.updateMany({
                        where: { requestId, itemId: alloc.itemId },
                        data: { approvedQty: parseFloat(alloc.approvedQty) }
                    });
                }

                const updatedReq = await tx.stockRequest.update({
                    where: { id: requestId },
                    data: { status: 'COMPLETED', approvedById } // Marking as COMPLETED immediately for simplicity
                });

                // Prepare transaction logs
                const transferItems = [];

                for (const alloc of allocation) {
                    const qty = parseFloat(alloc.approvedQty);
                    if (qty <= 0) continue;

                    // 2. Reduce Main Store Stock
                    await tx.inventoryStock.upsert({
                        where: { storeId_itemId: { storeId: stockReq.toStoreId, itemId: alloc.itemId } },
                        update: { quantity: { decrement: qty } },
                        create: { storeId: stockReq.toStoreId, itemId: alloc.itemId, quantity: -qty } // Should not happen ideally if check is done
                    });

                    // 3. Add Branch Stock
                    await tx.inventoryStock.upsert({
                        where: { storeId_itemId: { storeId: stockReq.fromStoreId, itemId: alloc.itemId } },
                        update: { quantity: { increment: qty } },
                        create: { storeId: stockReq.fromStoreId, itemId: alloc.itemId, quantity: qty }
                    });

                    transferItems.push({ itemId: alloc.itemId, quantity: qty });
                }

                // 4. Log Transactions
                // OUT from Main
                await tx.inventoryTransaction.create({
                    data: {
                        type: 'TRANSFER_OUT',
                        storeId: stockReq.toStoreId,
                        referenceId: stockReq.id,
                        userId: approvedById,
                        notes: `Transfer to ${stockReq.fromStoreId}`, // Ideally store name, but ID is sufficient for link
                        items: { create: transferItems.map(i => ({ itemId: i.itemId, quantity: -i.quantity })) }
                    }
                });

                // IN to Branch
                await tx.inventoryTransaction.create({
                    data: {
                        type: 'TRANSFER_IN',
                        storeId: stockReq.fromStoreId,
                        referenceId: stockReq.id,
                        userId: approvedById,
                        notes: `Transfer from ${stockReq.toStoreId}`,
                        items: { create: transferItems.map(i => ({ itemId: i.itemId, quantity: i.quantity })) }
                    }
                });

                return updatedReq;
            });

            return NextResponse.json(result);
        }

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Failed to process request' }, { status: 500 });
    }
}

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const storeId = searchParams.get('storeId'); // Filter requests BY this store
        const isApprover = searchParams.get('isApprover') === 'true'; // If true, filter requests TO this store (Wait, usually Main Store views requests TO it)

        let where: any = {};

        if (storeId) {
            if (isApprover) {
                // If I am Main Store, I want to see requests Sent TO me
                where.toStoreId = storeId;
            } else {
                // If I am Branch, I want to see requests Sent BY me
                where.fromStoreId = storeId;
            }
        }

        const requests = await prisma.stockRequest.findMany({
            where,
            include: {
                fromStore: true,
                toStore: true,
                requestedBy: true,
                items: { include: { item: true } }
            },
            orderBy: { createdAt: 'desc' }
        });

        return NextResponse.json(requests);

    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch requests' }, { status: 500 });
    }
}
