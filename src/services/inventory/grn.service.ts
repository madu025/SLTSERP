import { prisma } from '@/lib/prisma';
import { GRN } from '@prisma/client';
import { NotificationService } from '../notification.service';
import { emitSystemEvent } from '@/lib/events';
import { CreateGRNData, TransactionClient } from './types';
import { StockService } from './stock.service';

export class GRNService {
    static async getGRNs(storeId?: string) {
        return await prisma.gRN.findMany({
            where: storeId ? { storeId } : {},
            include: {
                store: true,
                receivedBy: true,
                request: {
                    include: {
                        items: { include: { item: true } },
                        requestedBy: true,
                        approvedBy: true
                    }
                },
                items: {
                    include: {
                        item: true,
                        batch: true
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });
    }

    static async createGRN(data: CreateGRNData): Promise<GRN> {
        const { storeId, sourceType, supplier, receivedById, items, requestId, sltReferenceId } = data;

        return await prisma.$transaction(async (tx: TransactionClient) => {
            // 1. Create GRN
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const grn = await (tx as any).gRN.create({
                data: {
                    grnNumber: `GRN-${Date.now()}`,
                    storeId,
                    sourceType,
                    supplier,
                    receivedById,
                    requestId: requestId || null,
                    reference: sltReferenceId || null,
                    items: {
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        create: items.map((i: any) => ({
                            itemId: i.itemId,
                            quantity: parseFloat(i.quantity.toString())
                        }))
                    }
                },
                include: { items: true }
            });

            // 2. Fetch Item Metadata for Pricing
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const itemIds = items.map((i: any) => i.itemId);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const itemMetadata = await (tx as any).inventoryItem.findMany({
                where: { id: { in: itemIds } },
                select: { id: true, costPrice: true, unitPrice: true }
            });

            // 3. Update Stock & Create Batches
            const transactionItems: { itemId: string; quantity: number }[] = [];

            for (const item of items) {
                const qty = StockService.round(parseFloat(item.quantity.toString()));
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const meta = itemMetadata.find((m: any) => m.id === item.itemId);
                const costPrice = meta?.costPrice || 0;
                const unitPrice = meta?.unitPrice || 0;

                // A. Create Batch
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const batch = await (tx as any).inventoryBatch.create({
                    data: {
                        batchNumber: `BAT-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
                        itemId: item.itemId,
                        grnId: grn.id,
                        initialQty: qty,
                        costPrice: costPrice,
                        unitPrice: unitPrice,
                    }
                });

                // B. Link GRN Item to Batch
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const grnLine = grn.items.find((gi: any) => gi.itemId === item.itemId);
                if (grnLine) {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    await (tx as any).gRNItem.update({
                        where: { id: grnLine.id },
                        data: { batchId: batch.id }
                    });
                }

                // C. Initialize Batch Stock in Store
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                await (tx as any).inventoryBatchStock.create({
                    data: {
                        storeId,
                        batchId: batch.id,
                        itemId: item.itemId,
                        quantity: qty
                    }
                });

                // D. Update Store Stock Total
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                await (tx as any).inventoryStock.upsert({
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

            // 4. Create Transaction Log
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (tx as any).inventoryTransaction.create({
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

            // 4. Update Request Status if linked
            if (requestId) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const request = await (tx as any).stockRequest.findUnique({
                    where: { id: requestId },
                    include: { items: true }
                });

                if (request) {
                    let allItemsCompleted = true;

                    // Update received quantities for each item
                    for (const reqItem of request.items) {
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        const grnItem = items.find((gi: any) => gi.itemId === reqItem.itemId);
                        if (grnItem) {
                            const newReceivedQty = reqItem.receivedQty + parseFloat(grnItem.quantity.toString());

                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            await (tx as any).stockRequestItem.update({
                                where: { id: reqItem.id },
                                data: { receivedQty: newReceivedQty }
                            });

                            if (newReceivedQty < reqItem.requestedQty) {
                                allItemsCompleted = false;
                            }
                        } else {
                            if (reqItem.receivedQty < reqItem.requestedQty) {
                                allItemsCompleted = false;
                            }
                        }
                    }

                    const newStatus = allItemsCompleted ? 'COMPLETED' : 'PARTIALLY_COMPLETED';

                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const updatedReq = await (tx as any).stockRequest.update({
                        where: { id: requestId },
                        data: {
                            status: newStatus,
                            sltReferenceId: sltReferenceId || request.sltReferenceId
                        }
                    });

                    // Notify Requester that stock has arrived
                    try {
                        await NotificationService.send({
                            userId: updatedReq.requestedById,
                            title: newStatus === 'COMPLETED' ? 'Stock Fully Received' : 'Stock Partially Received',
                            message: `Materials for request ${updatedReq.requestNr} have arrived at the store via GRN ${grn.grnNumber}.`,
                            type: 'INVENTORY',
                            priority: 'HIGH',
                            link: '/admin/inventory/requests',
                            metadata: { requestId: updatedReq.id, grnNumber: grn.grnNumber, status: newStatus }
                        });
                    } catch (nErr) {
                        console.error("Failed to notify stock arrival:", nErr);
                    }
                }
            }

            emitSystemEvent('INVENTORY_UPDATE');
            return grn;
        });
    }
}
