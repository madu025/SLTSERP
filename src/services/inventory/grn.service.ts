import { prisma } from '@/lib/prisma';
import { GRN, Prisma } from '@prisma/client';
import { NotificationService } from '../notification.service';
import { emitSystemEvent } from '@/lib/events';
import { CreateGRNData, TransactionClient } from './types';
import { StockService } from './stock.service';
import { LedgerService } from '../finance/ledger.service';

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
            // Promote CUSTOM/Unregistered items to standard SLTS type
            const rawItemIds = items.map((i) => i.itemId);
            const dbItems = await tx.inventoryItem.findMany({
                where: { id: { in: rawItemIds } }
            });
            for (const dbItem of dbItems) {
                if (dbItem.type === 'CUSTOM' || dbItem.code.startsWith('UNREG-')) {
                    const newCode = `MAT-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
                    await tx.inventoryItem.update({
                        where: { id: dbItem.id },
                        data: {
                            type: 'SLTS',
                            code: newCode,
                            description: dbItem.description 
                                ? `${dbItem.description} (Registered via GRN)`
                                : `Registered via GRN`
                        }
                    });
                }
            }

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
            const transactionItems: { itemId: string; quantity: number; batchId?: string }[] = [];
            let totalGrnCost = 0;

            for (const item of items) {
                const qty = StockService.round(parseFloat(item.quantity.toString()));
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const meta = itemMetadata.find((m: any) => m.id === item.itemId);
                const costPrice = meta?.costPrice || 0;
                totalGrnCost += Number(costPrice) * qty;
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
                        expiryDate: item.expiryDate ? new Date(item.expiryDate) : null
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
                        quantity: qty,
                        locator: item.locator || null
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
                    quantity: qty,
                    batchId: batch.id
                });

                // E. If the item is serialized, upsert serial records in bulk
                if (item.serials && Array.isArray(item.serials) && item.serials.length > 0) {
                    const snList = item.serials.map((s: string) => s.trim()).filter(Boolean);
                    if (snList.length > 0) {
                        const existingSerials = await tx.inventoryItemSerial.findMany({
                            where: { serialNumber: { in: snList } }
                        });
                        const existingMap = new Map(existingSerials.map(s => [s.serialNumber, s]));

                        const toUpdateIds: string[] = [];
                        const toCreateData: Prisma.InventoryItemSerialUncheckedCreateInput[] = [];

                        for (const sn of snList) {
                            const existing = existingMap.get(sn);
                            if (existing) {
                                toUpdateIds.push(existing.id);
                            } else {
                                toCreateData.push({
                                    itemId: item.itemId,
                                    serialNumber: sn,
                                    status: 'IN_STORE',
                                    storeId,
                                    locator: item.locator || null
                                } as Prisma.InventoryItemSerialUncheckedCreateInput);
                            }
                        }

                        if (toCreateData.length > 0) {
                            await tx.inventoryItemSerial.createMany({
                                data: toCreateData
                            });
                        }

                        if (toUpdateIds.length > 0) {
                            await tx.inventoryItemSerial.updateMany({
                                where: { id: { in: toUpdateIds } },
                                data: {
                                    status: 'IN_STORE',
                                    storeId,
                                    contractorId: null,
                                    sodId: null,
                                    locator: item.locator || null
                                } as Prisma.InventoryItemSerialUncheckedUpdateInput
                            });
                        }
                    }
                }
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

            // 3.5 Log receipt in General Ledger (real-time double-entry)
            await LedgerService.logGrnReceipt(tx, grn.id, totalGrnCost);

            // 4. Update Request Status if linked
            if (requestId) {
                // Lock the StockRequest row to prevent concurrent race conditions
                await tx.$executeRaw`SELECT id FROM "StockRequest" WHERE id = ${requestId} FOR UPDATE`;

                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const request = await (tx as any).stockRequest.findUnique({
                    where: { id: requestId },
                    include: { items: true }
                });

                if (request) {
                    if (request.status !== 'APPROVED') {
                        throw new Error(`CANNOT_RECEIVE_GRN_FOR_UNAPPROVED_REQUEST: Stock Request ${request.requestNr} has status ${request.status} and must be APPROVED first.`);
                    }

                    let allItemsCompleted = true;

                    // Update received quantities for each item
                    for (const reqItem of request.items) {
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        const grnItem = items.find((gi: any) => gi.itemId === reqItem.itemId);
                        if (grnItem) {
                            const newReceivedQty = reqItem.receivedQty + parseFloat(grnItem.quantity.toString());
                            const limitQty = reqItem.approvedQty;
                            if (newReceivedQty > limitQty) {
                                throw new Error(`GRN_QUANTITY_EXCEEDS_APPROVED_LIMIT: Received quantity of ${newReceivedQty} exceeds approved limit of ${limitQty} for item ${reqItem.itemId}`);
                            }

                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            await (tx as any).stockRequestItem.update({
                                where: { id: reqItem.id },
                                data: { receivedQty: newReceivedQty }
                            });

                            if (newReceivedQty < limitQty) {
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
                            link: '/inventory/requests',
                            metadata: { requestId: updatedReq.id, grnNumber: grn.grnNumber, status: newStatus }
                        });
                    } catch (nErr) {
                        console.error("Failed to notify stock arrival:", nErr);
                    }
                }
            }

            emitSystemEvent('INVENTORY_UPDATE');
            return grn;
        }, { timeout: 30000 });
    }
}
