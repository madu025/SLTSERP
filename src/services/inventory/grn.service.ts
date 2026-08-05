import { AppError } from '@/lib/error';
import { prisma } from '@/lib/prisma';
import { safe } from '@/utils/safe-await.util';
import { GRN, Prisma } from '@prisma/client';
import { NotificationService } from '@/services/notification/notification.service';
import { emitSystemEvent } from '@/lib/events';
import { CreateGRNData, TransactionClient } from '@/types/inventory/inventory-service.types';
import { StockService } from './stock.service';
import { AuditLedgerService } from './audit-ledger.service';
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
                        approvedBy: true,
                        purchaseOrders: true
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
        const { storeId, sourceType, supplier, receivedById, items, requestId, purchaseOrderId, sltReferenceId, reference, documentUrl } = data;

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

            // 1. Create GRN with an atomic document number
            const grnNumber = await AuditLedgerService.getNextDocumentNumber('GRN', tx);
            const grn = await tx.gRN.create({
                data: {
                    grnNumber,
                    storeId,
                    sourceType,
                    supplier,
                    receivedById,
                    requestId: requestId || null,
                    purchaseOrderId: purchaseOrderId || null,
                    reference: reference || sltReferenceId || null,
                    documentUrl: documentUrl || null,
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
            const transactionItems: { itemId: string; quantity: number; batchId?: string }[] = [];
            let totalGrnCost = 0;

            for (const item of items) {
                const qty = StockService.round(parseFloat(item.quantity.toString()));
                
                const meta = itemMetadata.find((m) => m.id === item.itemId);
                const costPrice = meta?.costPrice || 0;
                totalGrnCost += Number(costPrice) * qty;
                const unitPrice = meta?.unitPrice || 0;

                // A. Create Batch
                const lotNumber = await AuditLedgerService.getNextDocumentNumber('LOT', tx);
                const batch = await tx.inventoryBatch.create({
                    data: {
                        batchNumber: lotNumber, // Auto-incrementing Lot Number
                        itemId: item.itemId,
                        grnId: grn.id,
                        initialQty: qty,
                        costPrice: costPrice,
                        unitPrice: unitPrice,
                        expiryDate: item.expiryDate ? new Date(item.expiryDate) : null
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
                        quantity: qty,
                        ...(item.locator ? { locatorId: item.locator } : {})
                    }
                });

                // D. Update Store Stock Total
                const updatedStoreStock = await tx.inventoryStock.upsert({
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

                // Write Immutable Inventory Ledger Entry
                const currentQtyAfter = updatedStoreStock?.quantity ? Number(updatedStoreStock.quantity) : 0;
                await AuditLedgerService.recordEntry({
                    storeId,
                    itemId: item.itemId,
                    batchId: batch.id,
                    transactionType: 'GRN_RECEIPT',
                    referenceType: 'GRN',
                    referenceId: grn.id,
                    quantityBefore: currentQtyAfter - qty,
                    quantityChange: qty,
                    quantityAfter: currentQtyAfter,
                    unitPrice: Number(unitPrice),
                    performedById: receivedById
                }, tx);

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
                        const existingMap = new Map(existingSerials.map((s) => [s.serialNumber, s]));

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
                                    locator: item.locator || undefined
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

            // 3.5 Log receipt in General Ledger (real-time double-entry)
            await LedgerService.logGrnReceipt(tx, grn.id, totalGrnCost);

            // 4. Update Request Status if linked
            if (requestId) {
                // Lock the StockRequest row to prevent concurrent race conditions
                await tx.$executeRaw`SELECT id FROM "StockRequest" WHERE id = ${requestId} FOR UPDATE`;

                const request = await tx.stockRequest.findUnique({
                    where: { id: requestId },
                    include: { items: true }
                });

                if (request) {
                    if (request.status !== 'APPROVED' && request.status !== 'PARTIALLY_COMPLETED') {
                        throw AppError.badRequest(`CANNOT_RECEIVE_GRN_FOR_UNAPPROVED_REQUEST: Stock Request ${request.requestNr} has status ${request.status} and must be APPROVED first.`);
                    }

                    let allItemsCompleted = true;

                    // Update received quantities for each item
                    for (const reqItem of request.items) {
                        const grnItem = items.find((gi) => gi.itemId === reqItem.itemId);
                        const limitQty = Number(reqItem.approvedQty) > 0 ? Number(reqItem.approvedQty) : Number(reqItem.requestedQty);
                        
                        if (grnItem) {
                            const newReceivedQty = reqItem.receivedQty.toNumber() + parseFloat(grnItem.quantity.toString());
                            if (newReceivedQty > limitQty) {
                                throw AppError.badRequest(`GRN_QUANTITY_EXCEEDS_APPROVED_LIMIT: Received quantity of ${newReceivedQty} exceeds approved limit of ${limitQty} for item ${reqItem.itemId}`);
                            }

                            await tx.stockRequestItem.update({
                                where: { id: reqItem.id },
                                data: { receivedQty: newReceivedQty }
                            });

                            if (newReceivedQty < limitQty) {
                                allItemsCompleted = false;
                            }
                        } else {
                            if (Number(reqItem.receivedQty) < limitQty) {
                                allItemsCompleted = false;
                            }
                        }
                    }

                    const newStatus = allItemsCompleted ? 'COMPLETED' : 'PARTIALLY_COMPLETED';
                    const newWorkflowStage = allItemsCompleted ? 'COMPLETED' : request.workflowStage;

                    const updatedReq = await tx.stockRequest.update({
                        where: { id: requestId },
                        data: {
                            status: newStatus,
                            workflowStage: newWorkflowStage,
                            sltReferenceId: sltReferenceId || request.sltReferenceId
                        }
                    });

                    // Notify Requester that stock has arrived
                    const [nErr] = await safe(NotificationService.send({
                        userId: updatedReq.requestedById,
                        title: newStatus === 'COMPLETED' ? 'Stock Fully Received' : 'Stock Partially Received',
                        message: `Materials for request ${updatedReq.requestNr} have arrived at the store via GRN ${grn.grnNumber}.`,
                        type: 'INVENTORY',
                        priority: 'HIGH',
                        link: '/inventory/requests',
                        metadata: { requestId: updatedReq.id, grnNumber: grn.grnNumber, status: newStatus }
                    }));
                    if (nErr) {
                        console.error("Failed to notify stock arrival:", nErr);
                    }
                }
            }

            emitSystemEvent('INVENTORY_UPDATE');
            return grn;
        }, { timeout: 30000 });
    }
}
