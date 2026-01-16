import { prisma } from '@/lib/prisma';
import { GRN, Prisma } from '@prisma/client';
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
            const grn = await tx.gRN.create({
                data: {
                    grnNumber: `GRN-${Date.now()}`,
                    storeId,
                    sourceType,
                    supplier,
                    receivedById,
                    requestId: requestId || null,
                    reference: sltReferenceId || null,
                    items: {
                        create: items.map((i) => ({
                            itemId: i.itemId,
                            quantity: parseFloat(i.quantity.toString())
                        }))
                    }
                },
                include: { items: true }
            });

            // 2. Fetch Item Metadata for Pricing
            const itemIds = items.map((i) => i.itemId);
            const itemMetadata = await tx.inventoryItem.findMany({
                where: { id: { in: itemIds } },
                select: { id: true, costPrice: true, unitPrice: true }
            });

            // 3. Update Stock & Create Batches
            const transactionItems = [];

            for (const item of items) {
                const qty = StockService.round(parseFloat(item.quantity.toString()));
                const meta = itemMetadata.find((m) => m.id === item.itemId);
                const costPrice = meta?.costPrice || 0;
                const unitPrice = meta?.unitPrice || 0;

                // A. Create Batch
                const batch = await tx.inventoryBatch.create({
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
                const grnLine = grn.items.find((gi) => gi.itemId === item.itemId);
                if (grnLine) {
                    await tx.gRNItem.update({
                        where: { id: grnLine.id },
                        data: { batchId: batch.id }
                    });
                }

                // C. Initialize Batch Stock in Store
                await tx.inventoryBatchStock.create({
                    data: {
                        storeId,
                        batchId: batch.id,
                        itemId: item.itemId,
                        quantity: qty
                    }
                });

                // D. Upsert Total Stock (Legacy support & quick lookups)
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

            // 4. Update Request Status if linked
            if (requestId) {
                const request = await tx.stockRequest.findUnique({
                    where: { id: requestId },
                    include: { items: true }
                });

                if (request) {
                    let allItemsCompleted = true;

                    // Update received quantities for each item
                    for (const reqItem of request.items) {
                        const grnItem = items.find((gi) => gi.itemId === reqItem.itemId);
                        if (grnItem) {
                            const newReceivedQty = reqItem.receivedQty + parseFloat(grnItem.quantity.toString());

                            await tx.stockRequestItem.update({
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

                    const updatedReq = await tx.stockRequest.update({
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
