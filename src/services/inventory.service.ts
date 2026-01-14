import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { NotificationService } from './notification.service';
import { AuditService } from './audit.service';

export class InventoryService {
    // Round to 4 decimal places to prevent floating point issues
    private static round(val: number): number {
        return Math.round(val * 10000) / 10000;
    }

    // --- ITEM MANAGEMENT ---

    /**
     * Fetch all items with optional filtering (Context-based)
     */
    static async getItems(context?: string) {
        // Use raw query to fetch all fields to bypass potential stale client issues
        let items: any[] = await prisma.$queryRaw`SELECT * FROM "InventoryItem" ORDER BY "code" ASC`;

        if (context === 'OSP_FTTH') {
            const configs: any[] = await prisma.$queryRaw`SELECT value FROM "SystemConfig" WHERE key = 'OSP_MATERIAL_SOURCE' LIMIT 1`;
            const source = configs[0]?.value || 'SLT';

            items = items.filter((item: any) => {
                // Precise filtering based on Admin Assignment (isOspFtth flag)
                if (!item.isOspFtth) return false;

                // Source Type Filtering
                if (source === 'SLT') {
                    return item.type === 'SLT';
                } else {
                    // COMPANY / SLTS
                    return item.type !== 'SLT';
                }
            });
        }

        return items;
    }

    static async createItem(data: any) {
        // Basic Validation
        if (!data.code || !data.name) {
            throw new Error('CODE_AND_NAME_REQUIRED');
        }

        try {
            const item = await prisma.inventoryItem.create({
                data: {
                    code: data.code,
                    name: data.name,
                    description: data.description,
                    unit: data.unit || 'Nos',
                    type: data.type || 'SLTS',
                    category: data.category || 'OTHERS',
                    commonFor: data.commonFor || ['FTTH', 'PSTN', 'OSP', 'OTHERS'],
                    minLevel: data.minLevel ? parseFloat(data.minLevel) : 0,
                    unitPrice: data.unitPrice ? parseFloat(data.unitPrice) : 0,
                    costPrice: data.costPrice ? parseFloat(data.costPrice) : 0,
                    isWastageAllowed: data.isWastageAllowed !== undefined ? data.isWastageAllowed : true,
                    maxWastagePercentage: data.maxWastagePercentage ? parseFloat(data.maxWastagePercentage) : 0
                } as any
            });

            const { emitSystemEvent } = require('@/lib/events');
            emitSystemEvent('INVENTORY_UPDATE');
            return item;
        } catch (error: any) {
            if (error.code === 'P2002') {
                throw new Error('ITEM_EXISTS');
            }
            throw error;
        }
    }

    static async updateItem(id: string, data: any) {
        if (!id) throw new Error('ID_REQUIRED');

        return await prisma.inventoryItem.update({
            where: { id },
            data: {
                name: data.name,
                description: data.description,
                unit: data.unit,
                type: data.type,
                category: data.category,
                commonFor: data.commonFor,
                minLevel: data.minLevel ? parseFloat(data.minLevel) : 0,
                unitPrice: data.unitPrice ? parseFloat(data.unitPrice) : 0,
                costPrice: data.costPrice ? parseFloat(data.costPrice) : 0,
                isWastageAllowed: data.isWastageAllowed,
                maxWastagePercentage: data.maxWastagePercentage ? parseFloat(data.maxWastagePercentage) : 0
            } as Prisma.InventoryItemUpdateInput
        });
    }

    static async patchBulkItems(updates: any[]) {
        if (!Array.isArray(updates)) {
            throw new Error('UPDATES_MUST_BE_ARRAY');
        }

        const stats = { count: 0 };

        for (const update of updates) {
            const { id, tags, ...rest } = update;
            const data: any = { ...rest };

            if (tags) {
                data.commonFor = tags;
            }

            data.updatedAt = new Date();

            await prisma.inventoryItem.update({
                where: { id },
                data
            });
            stats.count++;
        }

        return stats;
    }

    static async deleteItem(id: string) {
        if (!id) throw new Error('ID_REQUIRED');

        // Check stock
        const hasStock = await prisma.inventoryStock.findFirst({ where: { itemId: id, quantity: { gt: 0 } } });
        if (hasStock) throw new Error('ITEM_HAS_STOCK');

        try {
            await prisma.inventoryItem.delete({ where: { id } });
        } catch (error) {
            throw new Error('ITEM_USED_IN_TRANSACTIONS');
        }
    }

    // --- STORE MANAGEMENT ---

    static async getStores(where: any = {}) {
        return await prisma.inventoryStore.findMany({
            where,
            include: {
                manager: {
                    select: { id: true, name: true, email: true }
                },
                opmcs: {
                    select: { id: true, name: true, rtom: true }
                }
            },
            orderBy: { name: 'asc' }
        });
    }

    static async createStore(data: any) {
        const { opmcIds, ...storeData } = data;

        const store = await prisma.inventoryStore.create({
            data: {
                name: storeData.name,
                type: storeData.type,
                location: storeData.location,
                managerId: storeData.managerId === 'none' ? null : storeData.managerId
            }
        });

        if (opmcIds && Array.isArray(opmcIds) && opmcIds.length > 0) {
            await prisma.oPMC.updateMany({
                where: { id: { in: opmcIds } },
                data: { storeId: store.id }
            });
        }

        return store;
    }

    static async updateStore(id: string, data: any) {
        if (!id) throw new Error('ID_REQUIRED');

        const { opmcIds, ...storeData } = data;

        const store = await prisma.inventoryStore.update({
            where: { id },
            data: {
                name: storeData.name,
                type: storeData.type,
                location: storeData.location,
                managerId: storeData.managerId === 'none' ? null : storeData.managerId
            }
        });

        // Update OPMC assignments
        if (opmcIds !== undefined) {
            // First, remove all current assignments
            await prisma.oPMC.updateMany({
                where: { storeId: id },
                data: { storeId: null }
            });

            // Then assign new OPMCs
            if (Array.isArray(opmcIds) && opmcIds.length > 0) {
                await prisma.oPMC.updateMany({
                    where: { id: { in: opmcIds } },
                    data: { storeId: id }
                });
            }
        }

        return store;
    }

    static async getStore(id: string) {
        return await prisma.inventoryStore.findUnique({
            where: { id },
            include: {
                opmcs: true,
                manager: true
            }
        });
    }

    static async deleteStore(id: string) {
        if (!id) throw new Error('ID_REQUIRED');

        const hasStock = await prisma.inventoryStock.findFirst({ where: { storeId: id, quantity: { gt: 0 } } });
        if (hasStock) throw new Error('STORE_HAS_STOCK');

        // Check transactions? Optional, but safer.
        // const hasTx = await prisma.stockMovement.findFirst({ where: { storeId: id } });
        // if (hasTx) throw new Error('STORE_HAS_TRANSACTIONS');

        // Remove OPMC assignments first
        await prisma.oPMC.updateMany({
            where: { storeId: id },
            data: { storeId: null }
        });

        await prisma.inventoryStore.delete({ where: { id: id } });
    }

    /**
     * Check if item stock is below minimum level and notify
     */
    static async checkLowStock(storeId: string, itemId: string) {
        try {
            const stock = await prisma.inventoryStock.findUnique({
                where: { storeId_itemId: { storeId, itemId } },
                include: {
                    item: true,
                    store: {
                        include: { opmcs: { select: { id: true } } }
                    }
                }
            });

            if (stock && stock.item.minLevel > 0 && stock.quantity < stock.item.minLevel) {
                const message = `Item "${stock.item.name}" (${stock.item.code}) in store "${stock.store.name}" is low on stock. Current: ${stock.quantity} ${stock.item.unit}, Min Level: ${stock.item.minLevel}.`;

                // Notify Store Manager and ARMs
                await NotificationService.notifyByRole({
                    roles: ['SUPER_ADMIN', 'ADMIN', 'STORES_MANAGER', 'AREA_MANAGER', 'OFFICE_ADMIN'],
                    title: "Low Stock Alert",
                    message,
                    type: 'INVENTORY',
                    priority: 'HIGH',
                    link: `/admin/inventory/stocks`,
                    opmcId: stock.store.opmcs?.[0]?.id // Best effort OPMC
                });

                const { emitSystemEvent } = require('@/lib/events');
                emitSystemEvent('INVENTORY_UPDATE');
            }
        } catch (error) {
            console.error("Failed to check low stock:", error);
        }
    }

    // --- STOCK MANAGEMENT ---

    static async getStock(storeId: string) {
        if (!storeId) throw new Error('STORE_ID_REQUIRED');

        return await prisma.inventoryStock.findMany({
            where: { storeId },
            include: {
                item: true
            },
            orderBy: { item: { code: 'asc' } }
        });
    }

    static async getStoreBatches(storeId: string, itemId?: string) {
        return await (prisma as any).inventoryBatchStock.findMany({
            where: {
                storeId,
                ...(itemId ? { itemId } : {})
            },
            include: {
                batch: {
                    include: {
                        grn: { select: { grnNumber: true, createdAt: true } }
                    }
                },
                item: true
            },
            orderBy: { batch: { createdAt: 'desc' } }
        });
    }

    static async getContractorBatches(contractorId: string, itemId?: string) {
        return await (prisma as any).contractorBatchStock.findMany({
            where: {
                contractorId,
                ...(itemId ? { itemId } : {})
            },
            include: {
                batch: {
                    include: {
                        grn: { select: { grnNumber: true, createdAt: true } }
                    }
                },
                item: true
            },
            orderBy: { batch: { createdAt: 'desc' } }
        });
    }

    /**
     * Initialize or Adjust Stock Levels in Bulk
     */
    static async initializeStock(storeId: string, items: any[], reason?: string, userId?: string) {
        if (!storeId || !Array.isArray(items)) throw new Error('INVALID_PAYLOAD');

        return await prisma.$transaction(async (tx) => {
            const transactionItems = [];

            for (const item of items) {
                const newQty = this.round(parseFloat(item.quantity));
                if (isNaN(newQty)) continue;

                // Get current stock
                const currentStock = await (tx as any).inventoryStock.findUnique({
                    where: { storeId_itemId: { storeId, itemId: item.itemId } }
                });

                const oldQty = currentStock ? this.round(currentStock.quantity) : 0;
                const diff = this.round(newQty - oldQty);

                if (diff === 0) continue; // No change

                // A. BATCH HANDLING
                if (diff > 0) {
                    // 1. Create a special adjustment batch for increases
                    const itemData = await (tx as any).inventoryItem.findUnique({
                        where: { id: item.itemId },
                        select: { costPrice: true, unitPrice: true }
                    }) as any;

                    const batch = await (tx as any).inventoryBatch.create({
                        data: {
                            batchNumber: `ADJ-${Date.now()}`,
                            itemId: item.itemId,
                            initialQty: diff,
                            costPrice: itemData?.costPrice || 0,
                            unitPrice: itemData?.unitPrice || 0
                        }
                    });

                    await (tx as any).inventoryBatchStock.create({
                        data: {
                            storeId,
                            batchId: batch.id,
                            itemId: item.itemId,
                            quantity: diff
                        }
                    });
                } else {
                    // 2. FIFO Deduction for decreases
                    const reduceQty = Math.abs(diff);
                    const pickedBatches = await InventoryService.pickStoreBatchesFIFO(tx, storeId, item.itemId, reduceQty);

                    for (const picked of pickedBatches) {
                        await (tx as any).inventoryBatchStock.update({
                            where: { storeId_batchId: { storeId, batchId: picked.batchId } },
                            data: { quantity: { decrement: picked.quantity } }
                        });
                    }
                }

                // B. UPDATE GLOBAL STOCK (Legacy/Summary)
                await (tx as any).inventoryStock.upsert({
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
                await (tx as any).inventoryTransaction.create({
                    data: {
                        type: 'ADJUSTMENT', // or INITIAL_STOCK
                        storeId,
                        userId: userId || 'SYSTEM',
                        referenceId: `INIT-STOCK-${Date.now()}`,
                        notes: reason || 'Initial Stock Setup',
                        items: {
                            create: transactionItems.map((ti: any) => ({
                                itemId: ti.itemId,
                                quantity: ti.quantity
                            }))
                        }
                    }
                });
            }

            return transactionItems.length;
        });
    }

    // --- FIFO BATCH HELPERS ---

    /**
     * Pick batches from a store based on FIFO
     */
    static async pickStoreBatchesFIFO(tx: any, storeId: string, itemId: string, requiredQty: number) {
        // Round required qty to avoid floating point mismatches during comparison
        const qtyToPick = this.round(requiredQty);

        // LOCKING: Prevent concurrent modifications to the same item's batches in this store
        await tx.$executeRaw`SELECT * FROM "InventoryBatchStock" WHERE "storeId" = ${storeId} AND "itemId" = ${itemId} FOR UPDATE`;

        const batches = await (tx as any).inventoryBatchStock.findMany({
            where: { storeId, itemId, quantity: { gt: 0 } },
            include: { batch: true },
            orderBy: { batch: { createdAt: 'asc' } }
        });

        const pickedBatches = [];
        let remainingToPick = qtyToPick;

        for (const stock of batches) {
            if (remainingToPick <= 0) break;
            const available = this.round(stock.quantity);
            const take = Math.min(available, remainingToPick);
            pickedBatches.push({
                batchId: stock.batchId,
                quantity: this.round(take),
                batch: stock.batch
            });
            remainingToPick = this.round(remainingToPick - take);
        }

        if (remainingToPick > 0) {
            throw new Error(`INSUFFICIENT_BATCH_STOCK_FOR_ITEM_${itemId}: Missing ${remainingToPick}`);
        }

        return pickedBatches;
    }

    /**
     * Pick batches from a contractor based on FIFO with locking
     */
    static async pickContractorBatchesFIFO(tx: any, contractorId: string, itemId: string, requiredQty: number) {
        const qtyToPick = this.round(requiredQty);

        // LOCKING: Prevent concurrent modifications to the same item's batches for this contractor
        await tx.$executeRaw`SELECT * FROM "ContractorBatchStock" WHERE "contractorId" = ${contractorId} AND "itemId" = ${itemId} FOR UPDATE`;

        const batches = await (tx as any).contractorBatchStock.findMany({
            where: { contractorId, itemId, quantity: { gt: 0 } },
            include: { batch: true },
            orderBy: { batch: { createdAt: 'asc' } }
        });

        const pickedBatches = [];
        let remainingToPick = qtyToPick;

        for (const stock of batches) {
            if (remainingToPick <= 0) break;
            const available = this.round(stock.quantity);
            const take = Math.min(available, remainingToPick);
            pickedBatches.push({
                batchId: stock.batchId,
                quantity: this.round(take),
                batch: stock.batch
            });
            remainingToPick = this.round(remainingToPick - take);
        }

        if (remainingToPick > 0) {
            throw new Error(`INSUFFICIENT_CONTRACTOR_BATCH_STOCK_FOR_ITEM_${itemId}: Missing ${remainingToPick}`);
        }

        return pickedBatches;
    }

    // --- GRN (GOODS RECEIVED NOTE) ---

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
                    } as any
                }
            },
            orderBy: { createdAt: 'desc' }
        });
    }

    static async createGRN(data: {
        storeId: string;
        sourceType: string;
        supplier?: string;
        receivedById: string;
        items: { itemId: string; quantity: string }[];
        requestId?: string;
        sltReferenceId?: string;
    }) {
        const { storeId, sourceType, supplier, receivedById, items, requestId, sltReferenceId } = data;

        return await prisma.$transaction(async (tx) => {
            // 1. Create GRN
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
                        create: items.map((i: any) => ({
                            itemId: i.itemId,
                            quantity: parseFloat(i.quantity)
                        }))
                    }
                },
                include: { items: true }
            });

            // 2. Fetch Item Metadata for Pricing
            const itemIds = items.map((i: any) => i.itemId);
            const itemMetadata = await (tx as any).inventoryItem.findMany({
                where: { id: { in: itemIds } },
                select: { id: true, costPrice: true, unitPrice: true }
            });

            // 3. Update Stock & Create Batches
            const transactionItems = [];

            for (const item of items) {
                const qty = this.round(parseFloat(item.quantity));
                const meta = itemMetadata.find((m: any) => m.id === item.itemId) as any;
                const costPrice = meta?.costPrice || 0;
                const unitPrice = meta?.unitPrice || 0;

                // A. Create Batch
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

                // B. Link GRN Item to Batch (Update the created item)
                const grnLine = grn.items.find((gi: any) => gi.itemId === item.itemId);
                if (grnLine) {
                    await (tx as any).gRNItem.update({
                        where: { id: grnLine.id },
                        data: { batchId: batch.id }
                    });
                }

                // C. Initialize Batch Stock in Store
                await (tx as any).inventoryBatchStock.create({
                    data: {
                        storeId,
                        batchId: batch.id,
                        itemId: item.itemId, // Composite key helper
                        quantity: qty
                    }
                });

                // D. Upsert Total Stock (Legacy support & quick lookups)
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


            // 3. Create Transaction Log
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
                const request = await (tx as any).stockRequest.findUnique({
                    where: { id: requestId },
                    include: { items: true }
                });

                if (request) {
                    let allItemsCompleted = true;
                    let isPartial = false;

                    // Update received quantities for each item
                    for (const reqItem of request.items) {
                        const grnItem = items.find((gi: any) => gi.itemId === reqItem.itemId);
                        if (grnItem) {
                            const newReceivedQty = reqItem.receivedQty + parseFloat(grnItem.quantity);

                            await (tx as any).stockRequestItem.update({
                                where: { id: reqItem.id },
                                data: { receivedQty: newReceivedQty }
                            });

                            if (newReceivedQty < reqItem.requestedQty) {
                                allItemsCompleted = false;
                                isPartial = true;
                            }
                        } else {
                            // Item not in this GRN
                            if (reqItem.receivedQty < reqItem.requestedQty) {
                                allItemsCompleted = false;
                            }
                            if (reqItem.receivedQty > 0) {
                                isPartial = true;
                            }
                        }
                    }

                    const newStatus = allItemsCompleted ? 'COMPLETED' : 'PARTIALLY_COMPLETED';

                    await (tx as any).stockRequest.update({
                        where: { id: requestId },
                        data: {
                            status: newStatus,
                            sltReferenceId: sltReferenceId || request.sltReferenceId
                        }
                    });
                }
            }

            const { emitSystemEvent } = require('@/lib/events');
            emitSystemEvent('INVENTORY_UPDATE');
            return grn;
        });
    }

    // --- MATERIAL ISSUES ---

    static async getMaterialIssues(contractorId: string, month?: string) {
        const whereClause: any = { contractorId };
        if (month) whereClause.month = month;

        return await prisma.contractorMaterialIssue.findMany({
            where: whereClause,
            include: {
                store: { select: { name: true } },
                items: {
                    include: {
                        item: { select: { name: true, code: true } }
                    }
                }
            },
            orderBy: { issueDate: 'desc' }
        });
    }

    static async issueMaterial(data: {
        contractorId: string;
        storeId: string;
        month: string;
        items: { itemId: string; quantity: string; unit?: string }[];
        userId?: string;
    }) {
        const { contractorId, storeId, month, items, userId } = data;

        const result = await prisma.$transaction(async (tx) => {
            // 1. Create Material Issue
            const materialIssue = await (tx as any).contractorMaterialIssue.create({
                data: {
                    contractorId,
                    storeId,
                    month,
                    issueDate: new Date(),
                    issuedBy: userId || 'SYSTEM',
                    items: {
                        create: items.map((i: any) => ({
                            itemId: i.itemId,
                            quantity: parseFloat(i.quantity),
                            unit: i.unit || 'Nos'
                        }))
                    }
                }
            });

            // 2. FIFO Stock Deduction & Batch Transfer
            const transactionItems = [];

            for (const item of items) {
                const qty = this.round(parseFloat(item.quantity));
                if (qty <= 0) continue;

                // A. Pick Batches using FIFO
                const pickedBatches = await InventoryService.pickStoreBatchesFIFO(tx, storeId, item.itemId, qty);

                for (const picked of pickedBatches) {
                    // Reduce from Store Batch Stock
                    await (tx as any).inventoryBatchStock.update({
                        where: { storeId_batchId: { storeId, batchId: picked.batchId } },
                        data: { quantity: { decrement: picked.quantity } }
                    });

                    // Add to Contractor Batch Stock
                    await (tx as any).contractorBatchStock.upsert({
                        where: { contractorId_batchId: { contractorId, batchId: picked.batchId } },
                        update: { quantity: { increment: picked.quantity } },
                        create: {
                            contractorId,
                            batchId: picked.batchId,
                            itemId: item.itemId,
                            quantity: picked.quantity
                        }
                    });

                    // C. Log EACH Batch Movement in Transaction Log
                    transactionItems.push({
                        itemId: item.itemId,
                        batchId: picked.batchId,
                        quantity: -picked.quantity // Negative for store deduction
                    });
                }

                // D. Update Global Store Stock (Legacy)
                await tx.inventoryStock.update({
                    where: { storeId_itemId: { storeId, itemId: item.itemId } },
                    data: { quantity: { decrement: qty } }
                });

                // E. Update Contractor Total Stock
                await (tx as any).contractorStock.upsert({
                    where: { contractorId_itemId: { contractorId, itemId: item.itemId } },
                    update: { quantity: { increment: qty } },
                    create: { contractorId, itemId: item.itemId, quantity: qty }
                });
            }

            // 3. Create Transaction Log
            await tx.inventoryTransaction.create({
                data: {
                    type: 'MATERIAL_ISSUE',
                    storeId,
                    referenceId: materialIssue.id,
                    userId: userId || 'SYSTEM',
                    notes: `Material issued to contractor ${contractorId} (FIFO Batched)`,
                    items: {
                        create: transactionItems.map((ti: any) => ({
                            itemId: ti.itemId,
                            batchId: ti.batchId,
                            quantity: ti.quantity
                        }))
                    }
                }
            });

            return materialIssue;
        });

        // Trigger Low Stock Alerts (non-blocking)
        try {
            for (const item of items) {
                this.checkLowStock(storeId, item.itemId);
            }
        } catch (e) {
            console.error("Low stock check failed:", e);
        }

        const { emitSystemEvent } = require('@/lib/events');
        emitSystemEvent('INVENTORY_UPDATE');
        return result;
    }


    // --- TRANSACTION HISTORY ---

    static async getTransactions(filters: {
        storeId?: string;
        itemId?: string;
        type?: string;
        startDate?: string;
        endDate?: string;
    }) {
        const where: any = {};

        if (filters.storeId) where.storeId = filters.storeId;
        if (filters.type) where.type = filters.type;

        if (filters.itemId) {
            where.items = {
                some: { itemId: filters.itemId }
            };
        }

        if (filters.startDate && filters.endDate) {
            where.date = {
                gte: new Date(filters.startDate),
                lte: new Date(filters.endDate)
            };
        }

        return await prisma.inventoryTransaction.findMany({
            where,
            include: {
                store: { select: { name: true, type: true } },
                items: {
                    include: {
                        item: { select: { code: true, name: true, unit: true } }
                    }
                },
            },
            orderBy: { date: 'desc' }
        });
    }

    // --- MRN (MATERIAL RETURN NOTE) ---

    static async createMRN(data: any) {
        const { storeId, returnType, returnTo, supplier, reason, grnId, returnedById, items } = data;

        // Note: Stock is NOT reduced here. Only after approval.
        const mrn = await prisma.mRN.create({
            data: {
                mrnNumber: `MRN-${Date.now()}`,
                storeId,
                returnType,
                returnTo: returnTo || null,
                supplier: supplier || null,
                reason: reason || null,
                grnId: grnId || null,
                returnedById,
                status: 'PENDING',
                items: {
                    create: items.map((i: any) => ({
                        itemId: i.itemId,
                        quantity: parseFloat(i.quantity),
                        reason: i.reason || null
                    }))
                }
            }
        });

        // Notify Stores Manager
        try {
            await NotificationService.notifyByRole({
                roles: ['STORES_MANAGER', 'ADMIN'],
                title: 'New MRN Created',
                message: `New Material Return Note ${mrn.mrnNumber} has been created and requires approval.`,
                type: 'INVENTORY',
                priority: 'MEDIUM',
                link: '/admin/inventory/mrns'
            });
        } catch (nErr) {
            console.error("Failed to notify for MRN:", nErr);
        }

        return mrn;
    }

    static async getMRNs(storeId?: string, status?: string) {
        const where: any = {};
        if (storeId) where.storeId = storeId;
        if (status) where.status = status;

        return await prisma.mRN.findMany({
            where,
            include: {
                store: true,
                returnedBy: true,
                approvedBy: true,
                items: {
                    include: { item: true }
                }
            },
            orderBy: { createdAt: 'desc' }
        });
    }

    static async updateMRNStatus(mrnId: string, action: 'APPROVE' | 'REJECT', approvedById: string) {
        if (action === 'REJECT') {
            const updated = await prisma.mRN.update({
                where: { id: mrnId },
                data: {
                    status: 'REJECTED',
                    approvedById
                },
                include: { returnedBy: true }
            });

            // Notify Requester
            try {
                await NotificationService.send({
                    userId: updated.returnedById,
                    title: 'MRN Rejected',
                    message: `Your Material Return Note ${updated.mrnNumber} has been rejected.`,
                    type: 'INVENTORY',
                    priority: 'HIGH',
                    link: '/admin/inventory/mrns'
                });
            } catch (nErr) {
                console.error("Failed to notify MRN rejection:", nErr);
            }
            return updated;
        }

        if (action === 'APPROVE') {
            return await prisma.$transaction(async (tx) => {
                // Fetch MRN details
                const mrn = await tx.mRN.findUnique({
                    where: { id: mrnId },
                    include: { items: true }
                });

                if (!mrn) throw new Error("MRN_NOT_FOUND");

                // Update MRN status
                const updatedMrn = await tx.mRN.update({
                    where: { id: mrnId },
                    data: {
                        status: 'COMPLETED',
                        approvedById
                    }
                });

                // Reduce stock
                const transactionItems = [];
                for (const item of mrn.items) {
                    // A. FIFO Batch Deduction
                    const pickedBatches = await InventoryService.pickStoreBatchesFIFO(tx, mrn.storeId, item.itemId, item.quantity);

                    for (const picked of pickedBatches) {
                        await (tx as any).inventoryBatchStock.update({
                            where: { storeId_batchId: { storeId: mrn.storeId, batchId: picked.batchId } },
                            data: { quantity: { decrement: picked.quantity } }
                        });
                    }

                    // B. Total Stock Update
                    await (tx as any).inventoryStock.upsert({
                        where: { storeId_itemId: { storeId: mrn.storeId, itemId: item.itemId } },
                        update: { quantity: { decrement: item.quantity } },
                        create: { storeId: mrn.storeId, itemId: item.itemId, quantity: -item.quantity }
                    });

                    transactionItems.push({
                        itemId: item.itemId,
                        quantity: -item.quantity // Negative for return to supplier
                    });
                }

                // Log transaction
                await (tx as any).inventoryTransaction.create({
                    data: {
                        type: 'RETURN',
                        storeId: mrn.storeId,
                        referenceId: mrn.id,
                        userId: approvedById,
                        notes: `MRN ${mrn.mrnNumber} - ${mrn.returnType}`,
                        items: {
                            create: transactionItems.map((ti: any) => ({
                                itemId: ti.itemId,
                                quantity: ti.quantity
                            }))
                        }
                    }
                });

                // Notify Requester
                try {
                    await NotificationService.send({
                        userId: updatedMrn.returnedById,
                        title: 'MRN Strategy Completed',
                        message: `Your Material Return Note ${updatedMrn.mrnNumber} has been approved and stock updated.`,
                        type: 'INVENTORY',
                        priority: 'MEDIUM',
                        link: '/admin/inventory/mrns'
                    });
                } catch (nErr) {
                    console.error("Failed to notify MRN completion:", nErr);
                }

                const { emitSystemEvent } = require('@/lib/events');
                emitSystemEvent('INVENTORY_UPDATE');
                return updatedMrn;
            });
        }

        throw new Error('INVALID_ACTION');
    }

    // --- WASTAGE MANAGEMENT ---

    static async recordWastage(data: {
        storeId?: string;
        contractorId?: string;
        month?: string;
        description?: string;
        reason?: string;
        items: { itemId: string; quantity: string; unit?: string }[];
        userId?: string;
    }) {
        const { storeId, contractorId, month, description, reason, items, userId } = data;

        // SCENARIO 1: Contractor Wastage (Reduce Contractor Stock)
        if (contractorId) {
            if (!storeId) throw new Error('STORE_ID_REQUIRED');

            return await prisma.$transaction(async (tx) => {
                const wastage = await (tx as any).contractorWastage.create({
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

                for (const item of items) {
                    const qty = this.round(parseFloat(item.quantity));
                    if (qty <= 0) continue;

                    // A. FIFO Deduction from Contractor Batches
                    const pickedBatches = await InventoryService.pickContractorBatchesFIFO(tx, contractorId, item.itemId, qty);
                    for (const picked of pickedBatches) {
                        await (tx as any).contractorBatchStock.update({
                            where: { contractorId_batchId: { contractorId, batchId: picked.batchId } },
                            data: { quantity: { decrement: picked.quantity } }
                        });
                    }

                    // B. Reduce Contractor Total Stock
                    await (tx as any).contractorStock.update({
                        where: { contractorId_itemId: { contractorId, itemId: item.itemId } },
                        data: { quantity: { decrement: qty } }
                    });
                }

                if (userId) {
                    await AuditService.log({
                        userId,
                        action: 'RECORD_CONTRACTOR_WASTAGE',
                        entity: 'ContractorWastage',
                        entityId: wastage.id,
                        newValue: wastage
                    });
                }

                return { message: 'Contractor wastage recorded', id: wastage.id };
            });
        }

        if (!storeId) throw new Error('STORE_ID_REQUIRED_FOR_STORE_WASTAGE');

        // SCENARIO 2: Store Wastage (Reduce Store Stock)
        return await prisma.$transaction(async (tx) => {
            const transactionItems = [];

            for (const item of items) {
                const qty = this.round(parseFloat(item.quantity));
                if (qty <= 0) continue;

                // A. FIFO Deduction from Store Batches
                const pickedBatches = await InventoryService.pickStoreBatchesFIFO(tx, storeId, item.itemId, qty);
                for (const picked of pickedBatches) {
                    await (tx as any).inventoryBatchStock.update({
                        where: { storeId_batchId: { storeId, batchId: picked.batchId } },
                        data: { quantity: { decrement: picked.quantity } }
                    });
                }

                // B. Reduce Store Total Stock
                await (tx as any).inventoryStock.upsert({
                    where: { storeId_itemId: { storeId, itemId: item.itemId } },
                    update: { quantity: { decrement: qty } },
                    create: { storeId, itemId: item.itemId, quantity: -qty }
                });

                transactionItems.push({ itemId: item.itemId, quantity: -qty });
            }

            // Create Transaction Log
            const txRecord = await (tx as any).inventoryTransaction.create({
                data: {
                    type: 'WASTAGE',
                    storeId,
                    userId: userId || 'SYSTEM',
                    referenceId: `STORE-WASTAGE-${Date.now()}`,
                    notes: reason || description,
                    items: {
                        create: transactionItems.map((ti: any) => ({
                            itemId: ti.itemId,
                            quantity: ti.quantity
                        }))
                    }
                }
            });

            if (userId) {
                await AuditService.log({
                    userId,
                    action: 'RECORD_STORE_WASTAGE',
                    entity: 'InventoryTransaction',
                    entityId: txRecord.id,
                    newValue: txRecord
                });
            }

            return txRecord;
        });
    }

    // --- STOCK REQUESTS & PROCUREMENT ---

    // Helper
    static generateRequestId = () => `REQ-${Date.now().toString().slice(-6)}`;

    static async createStockRequest(data: any) {
        const { fromStoreId, toStoreId, requestedById, items, priority, requiredDate, purpose, sourceType, projectTypes, maintenanceMonths, irNumber } = data;

        // --- VALIDATION LOGIC ---
        const fromStore = await prisma.inventoryStore.findUnique({
            where: { id: fromStoreId },
            include: { opmcs: { select: { id: true } } }
        });
        if (!fromStore) throw new Error("INVALID_STORE");

        // Rule: Sub Stores cannot request directly from SLT.
        // If Type is SUB and Source is SLT -> Error OR Pivot to request from Main Store?
        // User said: "sub stores walata direct slt head office requset kranna baha"
        // Meaning: Sub Stores MUST request from Main Store (Source Type should be 'MAIN_STORE' or similar, OR Source='SLT' but routed to Main Store?)
        // Let's assume:
        // - Source 'SLT' = Direct from Head Office (Only Main Store allowed)
        // - Source 'LOCAL_PURCHASE' = Allowed for all.
        // - Sub Stores requesting stock usually request from Main Store.

        // Fix Logic:
        let finalToStoreId = toStoreId;

        if (fromStore.type === 'SUB') {
            if (sourceType === 'SLT') {
                // Block Direct SLT request
                throw new Error("SUB_STORE_CANNOT_REQUEST_SLT");
            }
            // If they want stock from Main Store, usually the SourceType might be 'INTERNAL' or empty in UI?
            // But if page only has 'SLT' and 'LOCAL', how do they request from Main Store?
            // The prompt says: "Material Requisition kotas dekai... in pasu sub stores material requst eka" (Sub store request comes after).
            // It implies Sub Store requests FROM Main Store.
            // If the UI only sends 'toStoreId' = null, we need to assign Main Store as provider.

            if (sourceType !== 'LOCAL_PURCHASE' && !toStoreId) {
                // Find Main Store
                const mainStore = await prisma.inventoryStore.findFirst({ where: { type: 'MAIN' } });
                if (mainStore) finalToStoreId = mainStore.id;
            }
        }

        // --- END VALIDATION ---

        // Determine initial workflow stage based on store type
        const initialWorkflowStage = fromStore.type === 'SUB' ? 'ARM_APPROVAL' : 'OSP_MANAGER_APPROVAL';

        const req = await prisma.stockRequest.create({
            data: {
                requestNr: InventoryService.generateRequestId(),
                fromStoreId,
                toStoreId: finalToStoreId,
                requestedById,
                status: 'PENDING',
                priority: priority || 'MEDIUM',
                requiredDate: requiredDate ? new Date(requiredDate) : null,
                purpose: purpose || null,
                sourceType: sourceType || 'SLT',
                workflowStage: initialWorkflowStage,
                projectTypes: projectTypes || [],
                maintenanceMonths: maintenanceMonths || null,
                irNumber: irNumber || null,
                items: {
                    create: items.map((i: any) => ({
                        itemId: i.itemId,
                        requestedQty: parseFloat(i.requestedQty),
                        remarks: i.remarks || null,
                        make: i.make || null,
                        model: i.model || null,
                        suggestedVendor: i.suggestedVendor || null
                    }))
                }
            }
        });

        // Notify appropriate approvers based on store type
        try {
            if (fromStore.type === 'SUB') {
                await NotificationService.notifyByRole({
                    roles: ['AREA_MANAGER', 'OFFICE_ADMIN'],
                    title: 'New Material Request',
                    message: `New material request ${req.requestNr} from ${fromStore.name} requires your ARM approval.`,
                    type: 'INVENTORY',
                    priority: 'MEDIUM',
                    link: '/admin/inventory/approvals',
                    opmcId: fromStore.opmcs?.[0]?.id
                });
            } else {
                await NotificationService.notifyByRole({
                    roles: ['OSP_MANAGER'],
                    title: 'New Material Request',
                    message: `New material request ${req.requestNr} from ${fromStore.name} requires your OSP Manager approval.`,
                    type: 'INVENTORY',
                    priority: 'MEDIUM',
                    link: '/admin/inventory/approvals',
                    opmcId: fromStore.opmcs?.[0]?.id
                });
            }
        } catch (nErr) {
            console.error("Failed to send stock request notification:", nErr);
        }

        return req;
    }

    static async getStockRequests(filters: {
        storeId?: string;
        isApprover?: boolean;
        status?: string;
        workflowStage?: string;
    }) {
        let where: any = {};

        if (filters.storeId) {
            if (filters.isApprover) {
                // Main Store viewing incoming requests
                where.toStoreId = filters.storeId;
            } else {
                // Branch Store viewing outgoing requests
                where.fromStoreId = filters.storeId;
            }
        }

        if (filters.status) {
            const statuses = filters.status.split(',');
            where.status = { in: statuses };
        }

        if (filters.workflowStage) {
            where.workflowStage = { in: filters.workflowStage.split(',') };
        }

        return await prisma.stockRequest.findMany({
            where,
            include: {
                fromStore: true,
                toStore: true,
                requestedBy: true,
                items: { include: { item: true } }
            },
            orderBy: { createdAt: 'desc' }
        });
    }

    static async processStockRequestAction(data: any) {
        const { requestId, action, approvedById, allocation, remarks, sourceType, priority, irNumber, purpose, items, poNumber, vendor, expectedDelivery, procurementStatus } = data;

        // ========== 3-TIER APPROVAL SYSTEM ==========

        // 1. ARM_APPROVE (Area Manager Approval)
        if (action === 'ARM_APPROVE') {
            const updated = await prisma.stockRequest.update({
                where: { id: requestId },
                data: {
                    workflowStage: 'STORES_MANAGER_APPROVAL',
                    armAction: 'APPROVED',
                    armDate: new Date(),
                    armApprovedById: approvedById,
                    armRemarks: remarks
                }
            });

            // Notify Stores Managers
            try {
                await NotificationService.notifyByRole({
                    roles: ['STORES_MANAGER'],
                    title: 'Request Approved by ARM',
                    message: `Material request ${updated.requestNr} approved by ARM, requires Stores Manager approval.`,
                    type: 'INVENTORY',
                    priority: 'HIGH',
                    link: '/admin/inventory/approvals'
                });
            } catch (nErr) {
                console.error("Failed to notify Stores Manager:", nErr);
            }
            return updated;
        }

        // 2. ARM_REJECT (Return to requester for edit)
        if (action === 'ARM_REJECT') {
            const updated = await prisma.stockRequest.update({
                where: { id: requestId },
                data: {
                    workflowStage: 'RETURNED',
                    status: 'RETURNED',
                    armAction: 'REJECTED',
                    armDate: new Date(),
                    armApprovedById: approvedById,
                    armRemarks: remarks
                },
                include: { requestedBy: true }
            });

            // Notify Requester
            try {
                await NotificationService.send({
                    userId: updated.requestedById,
                    title: 'Material Request Returned',
                    message: `Your request ${updated.requestNr} has been returned by ARM. Reason: ${remarks}`,
                    type: 'INVENTORY',
                    priority: 'HIGH',
                    link: '/admin/inventory/requests'
                });
            } catch (nErr) {
                console.error("Failed to notify requester:", nErr);
            }
            return updated;
        }

        // 3. STORES_MANAGER_APPROVE
        if (action === 'STORES_MANAGER_APPROVE') {
            const updated = await prisma.stockRequest.update({
                where: { id: requestId },
                data: {
                    workflowStage: 'OSP_MANAGER_APPROVAL',
                    storesManagerAction: 'APPROVED',
                    storesManagerDate: new Date(),
                    storesManagerApprovedById: approvedById,
                    storesManagerRemarks: remarks
                }
            });

            // Notify OSP Managers
            try {
                await NotificationService.notifyByRole({
                    roles: ['OSP_MANAGER'],
                    title: 'Request Approved by Store Manager',
                    message: `Material request ${updated.requestNr} approved by Store Manager, requires OSP Manager final approval.`,
                    type: 'INVENTORY',
                    priority: 'HIGH',
                    link: '/admin/inventory/approvals'
                });
            } catch (nErr) {
                console.error("Failed to notify OSP Manager:", nErr);
            }
            return updated;
        }

        // 4. STORES_MANAGER_REJECT (Return to ARM)
        if (action === 'STORES_MANAGER_REJECT') {
            const updated = await prisma.stockRequest.update({
                where: { id: requestId },
                data: {
                    workflowStage: 'ARM_APPROVAL',
                    storesManagerAction: 'REJECTED',
                    storesManagerDate: new Date(),
                    storesManagerApprovedById: approvedById,
                    storesManagerRemarks: remarks
                },
                include: { armApprovedBy: true }
            });

            // Notify ARM who approved it
            if (updated.armApprovedById) {
                try {
                    await NotificationService.send({
                        userId: updated.armApprovedById,
                        title: 'Material Request Returned',
                        message: `Request ${updated.requestNr} has been returned by Stores Manager for your review.`,
                        type: 'INVENTORY',
                        priority: 'HIGH',
                        link: '/admin/inventory/approvals'
                    });
                } catch (nErr) {
                    console.error("Failed to notify ARM:", nErr);
                }
            }
            return updated;
        }

        // 5. OSP_MANAGER_REJECT (Return to Stores Manager)
        if (action === 'OSP_MANAGER_REJECT') {
            const updated = await prisma.stockRequest.update({
                where: { id: requestId },
                data: {
                    workflowStage: 'STORES_MANAGER_APPROVAL',
                    managerAction: 'REJECTED',
                    managerDate: new Date(),
                    approvedById,
                    remarks
                },
                include: { storesManagerApprovedBy: true }
            });

            // Notify Stores Manager
            if (updated.storesManagerApprovedById) {
                try {
                    await NotificationService.send({
                        userId: updated.storesManagerApprovedById,
                        title: 'Material Request Returned',
                        message: `Request ${updated.requestNr} has been returned by OSP Manager for your review.`,
                        type: 'INVENTORY',
                        priority: 'HIGH',
                        link: '/admin/inventory/approvals'
                    });
                } catch (nErr) {
                    console.error("Failed to notify Stores Manager:", nErr);
                }
            }
            return updated;
        }

        // ========== EXISTING ACTIONS (Updated) ==========

        // 1. RESUBMIT
        if (action === 'RESUBMIT') {
            await prisma.stockRequestItem.deleteMany({ where: { requestId } });

            const updated = await prisma.stockRequest.update({
                where: { id: requestId },
                data: {
                    status: 'PENDING',
                    workflowStage: 'REQUEST',
                    sourceType,
                    priority,
                    irNumber: irNumber || null,
                    purpose,
                    remarks: null,
                    items: {
                        create: items.map((i: any) => ({
                            itemId: i.itemId,
                            requestedQty: parseFloat(i.requestedQty),
                            remarks: i.remarks || null,
                            make: i.make || null,
                            model: i.model || null,
                            suggestedVendor: i.suggestedVendor || null
                        }))
                    }
                }
            });

            // Notify Managers
            try {
                await NotificationService.notifyByRole({
                    roles: ['OSP_MANAGER'],
                    title: 'Request Resubmitted',
                    message: `Material request ${updated.requestNr} has been resubmitted and requires your approval.`,
                    type: 'INVENTORY',
                    priority: 'MEDIUM',
                    link: '/admin/inventory/approvals'
                });
            } catch (nErr) {
                console.error("Failed to notify OSP Managers:", nErr);
            }
            return updated;
        }

        // 2. REJECT
        if (action === 'REJECT') {
            const updated = await prisma.stockRequest.update({
                where: { id: requestId },
                data: {
                    status: 'REJECTED',
                    approvedById,
                    remarks: remarks || null
                }
            });

            // Notify Requester
            try {
                await NotificationService.send({
                    userId: updated.requestedById,
                    title: 'Material Request Rejected',
                    message: `Your material request ${updated.requestNr} has been rejected.`,
                    type: 'INVENTORY',
                    priority: 'CRITICAL',
                    link: '/admin/inventory/requests'
                });
            } catch (nErr) {
                console.error("Failed to notify rejection:", nErr);
            }
            return updated;
        }

        // 3. MANAGER_APPROVE
        if (action === 'MANAGER_APPROVE') {
            const updated = await prisma.stockRequest.update({
                where: { id: requestId },
                data: {
                    workflowStage: 'PROCUREMENT',
                    procurementStatus: 'PENDING',
                    managerAction: 'APPROVED',
                    managerDate: new Date(),
                    remarks: remarks || undefined
                }
            });

            // Notify Procurement Officers
            try {
                await NotificationService.notifyByRole({
                    roles: ['STORES_MANAGER'],
                    title: 'Request Approved - PO Required',
                    message: `Material request ${updated.requestNr} has been approved and requires PO creation.`,
                    type: 'INVENTORY',
                    priority: 'HIGH',
                    link: '/admin/inventory/approvals'
                });
            } catch (nErr) {
                console.error("Failed to notify Stores Managers:", nErr);
            }
            return updated;
        }

        // 4. PROCUREMENT_COMPLETE
        if (action === 'PROCUREMENT_COMPLETE') {
            const updated = await prisma.stockRequest.update({
                where: { id: requestId },
                data: {
                    workflowStage: 'GRN_PENDING',
                    status: 'APPROVED',
                    procurementStatus: 'COMPLETED',
                    remarks: remarks || undefined
                }
            });

            // Notify Requester
            try {
                await NotificationService.send({
                    userId: updated.requestedById,
                    title: 'Procurement Completed',
                    message: `Procurement for request ${updated.requestNr} is complete. Waiting for GRN.`,
                    type: 'INVENTORY',
                    priority: 'MEDIUM',
                    link: '/admin/inventory/requests'
                });
            } catch (nErr) {
                console.error("Failed to notify procurement complete:", nErr);
            }
            return updated;
        }

        // 5. CREATE_PO
        if (action === 'CREATE_PO') {
            const request = await prisma.stockRequest.findUnique({
                where: { id: requestId },
                select: { sourceType: true }
            });

            const isCoveringPO = request?.sourceType === 'SLT';

            return await prisma.stockRequest.update({
                where: { id: requestId },
                data: {
                    poNumber,
                    vendor,
                    expectedDelivery: expectedDelivery ? new Date(expectedDelivery) : null,
                    procurementStatus: 'PO_CREATED',
                    isCoveringPO,
                    remarks: remarks || undefined
                }
            });
        }

        // 6. UPDATE_PROCUREMENT_STATUS
        if (action === 'UPDATE_PROCUREMENT_STATUS') {
            return await prisma.stockRequest.update({
                where: { id: requestId },
                data: {
                    procurementStatus,
                    remarks: remarks || undefined
                }
            });
        }

        // 6. OSP_MANAGER_APPROVE (Final Approval - OSP Manager)
        if (action === 'OSP_MANAGER_APPROVE' || action === 'APPROVE') {
            return await prisma.$transaction(async (tx) => {
                const stockReq = await (tx as any).stockRequest.findUnique({
                    where: { id: requestId },
                    include: { items: true, fromStore: true, toStore: true }
                });

                if (!stockReq) throw new Error("REQUEST_NOT_FOUND");

                // Update approved quantities if provided
                if (allocation && Array.isArray(allocation)) {
                    for (const alloc of allocation) {
                        await (tx as any).stockRequestItem.updateMany({
                            where: { requestId, itemId: alloc.itemId },
                            data: { approvedQty: parseFloat(alloc.approvedQty) }
                        });
                    }
                }

                // Scenario A: Local Purchase (Any Store)
                // Flow: OSP Approval → Procurement → GRN
                if (stockReq.sourceType === 'LOCAL_PURCHASE') {
                    const updated = await (tx as any).stockRequest.update({
                        where: { id: requestId },
                        data: {
                            status: 'APPROVED',
                            workflowStage: 'PROCUREMENT',
                            procurementStatus: 'PENDING',
                            approvedById,
                            managerAction: 'APPROVED',
                            managerDate: new Date(),
                            remarks: remarks || null
                        }
                    });

                    // Notify Procurement/Stores Managers
                    try {
                        await NotificationService.notifyByRole({
                            roles: ['STORES_MANAGER'],
                            title: 'Local Purchase Approved',
                            message: `Material request ${updated.requestNr} approved for Local Purchase, requires PO creation.`,
                            type: 'INVENTORY',
                            priority: 'HIGH',
                            link: '/admin/inventory/approvals'
                        });
                    } catch (nErr) {
                        console.error("Failed to notify Stores Managers:", nErr);
                    }
                    return updated;
                }

                // Scenario B: Main Store Distribution (Sub Store → Main Store)
                // Flow: OSP Approval → Main Store Release → Sub Store Receive
                if (stockReq.sourceType === 'MAIN_STORE' && stockReq.toStoreId) {
                    const updated = await (tx as any).stockRequest.update({
                        where: { id: requestId },
                        data: {
                            status: 'APPROVED',
                            workflowStage: 'MAIN_STORE_RELEASE',
                            approvedById,
                            managerAction: 'APPROVED',
                            managerDate: new Date(),
                            remarks: remarks || null
                        }
                    });

                    // Notify Main Store Assistants
                    try {
                        await NotificationService.notifyByRole({
                            roles: ['STORES_ASSISTANT'],
                            title: 'Material Release Required',
                            message: `Request ${updated.requestNr} approved, ready for release from Main Store to ${stockReq.fromStore?.name}.`,
                            type: 'INVENTORY',
                            priority: 'HIGH',
                            link: '/admin/inventory/approvals'
                        });
                    } catch (nErr) {
                        console.error("Failed to notify Store Assistants:", nErr);
                    }
                    return updated;
                }

                // Scenario C: SLT Request (Main Store → SLT Head Office)
                // Flow: OSP Approval → GRN Pending
                if (stockReq.sourceType === 'SLT') {
                    const updated = await (tx as any).stockRequest.update({
                        where: { id: requestId },
                        data: {
                            status: 'APPROVED',
                            workflowStage: 'GRN_PENDING',
                            approvedById,
                            managerAction: 'APPROVED',
                            managerDate: new Date(),
                            remarks: remarks || null
                        }
                    });

                    // Notify Stores Managers (Pending Shipment)
                    try {
                        await NotificationService.notifyByRole({
                            roles: ['STORES_MANAGER'],
                            title: 'SLT Request Approved',
                            message: `Request ${updated.requestNr} approved by OSP Manager. Waiting for shipment from SLT.`,
                            type: 'INVENTORY',
                            priority: 'MEDIUM',
                            link: '/admin/inventory/approvals'
                        });
                    } catch (nErr) {
                        console.error("Failed to notify Store Managers:", nErr);
                    }
                    return updated;
                }

                // Fallback
                return stockReq;
            });
        }

        // 7. MAIN_STORE_RELEASE (Main Store Assistant releases materials)
        if (action === 'MAIN_STORE_RELEASE') {
            return await prisma.$transaction(async (tx) => {
                const stockReq = await (tx as any).stockRequest.findUnique({
                    where: { id: requestId },
                    include: { items: true, fromStore: true }
                });

                if (!stockReq) throw new Error("REQUEST_NOT_FOUND");
                if (stockReq.workflowStage !== 'MAIN_STORE_RELEASE') throw new Error("INVALID_WORKFLOW_STAGE");

                // Update issued quantities and deduct from Main Store
                for (const alloc of allocation) {
                    const issuedQty = this.round(parseFloat(alloc.issuedQty));
                    if (issuedQty <= 0) continue;

                    // A. Update issued qty in request item
                    await (tx as any).stockRequestItem.updateMany({
                        where: { requestId, itemId: alloc.itemId },
                        data: { issuedQty }
                    });

                    // B. FIFO Deduction from Main Store Batches
                    const pickedBatches = await InventoryService.pickStoreBatchesFIFO(tx, stockReq.toStoreId!, alloc.itemId, issuedQty);

                    for (const picked of pickedBatches) {
                        // Reduce from Store Batch Stock
                        await (tx as any).inventoryBatchStock.update({
                            where: { storeId_batchId: { storeId: stockReq.toStoreId!, batchId: picked.batchId } },
                            data: { quantity: { decrement: picked.quantity } }
                        });
                    }

                    // C. Update Global Store Stock (Legacy)
                    await (tx as any).inventoryStock.update({
                        where: {
                            storeId_itemId: {
                                storeId: stockReq.toStoreId as string,
                                itemId: alloc.itemId
                            }
                        },
                        data: { quantity: { decrement: issuedQty } }
                    });

                    // D. Log TRANSFER_OUT transaction with Batch Details
                    await (tx as any).inventoryTransaction.create({
                        data: {
                            type: 'TRANSFER_OUT',
                            storeId: stockReq.toStoreId as string,
                            referenceId: stockReq.requestNr,
                            userId: approvedById || 'SYSTEM',
                            notes: `Released to ${stockReq.fromStore?.name} - Request ${stockReq.requestNr}`,
                            items: {
                                create: pickedBatches.map((p: any) => ({
                                    itemId: alloc.itemId,
                                    batchId: p.batchId,
                                    quantity: -p.quantity // Negative for deduction
                                }))
                            }
                        }
                    });
                }

                // Update request status
                const updated = await (tx as any).stockRequest.update({
                    where: { id: requestId },
                    data: {
                        workflowStage: 'SUB_STORE_RECEIVE',
                        releasedById: approvedById,
                        releasedDate: new Date(),
                        releasedRemarks: remarks
                    },
                    include: { requestedBy: true }
                });

                // Notify Sub Store Officer
                try {
                    await NotificationService.send({
                        userId: updated.requestedById,
                        title: 'Materials Released',
                        message: `Materials for request ${updated.requestNr} have been released. Please confirm receipt.`,
                        type: 'INVENTORY',
                        priority: 'HIGH',
                        link: '/admin/inventory/approvals'
                    });
                } catch (nErr) {
                    console.error("Failed to notify materials release:", nErr);
                }

                return updated;
            });
        }

        // 8. SUB_STORE_RECEIVE (Sub Store Officer confirms receipt)
        if (action === 'SUB_STORE_RECEIVE') {
            return await prisma.$transaction(async (tx) => {
                const stockReq = await (tx as any).stockRequest.findUnique({
                    where: { id: requestId },
                    include: { items: true }
                });

                if (!stockReq) throw new Error("REQUEST_NOT_FOUND");
                if (stockReq.workflowStage !== 'SUB_STORE_RECEIVE') throw new Error("INVALID_WORKFLOW_STAGE");

                let totalIssued = 0;
                let totalReceived = 0;

                // Update received quantities and add to Sub Store
                for (const alloc of allocation) {
                    const receivedQty = this.round(parseFloat(alloc.receivedQty));
                    const item = stockReq.items.find((i: any) => i.itemId === alloc.itemId);

                    if (!item) continue;
                    if (receivedQty <= 0) continue;
                    if (!stockReq.toStoreId) continue;

                    totalIssued += this.round(item.issuedQty || 0);
                    totalReceived += receivedQty;

                    // A. Update received qty in request item
                    await (tx as any).stockRequestItem.updateMany({
                        where: { requestId, itemId: alloc.itemId },
                        data: { receivedQty }
                    });

                    // B. Find Issuing Batches from Transaction Log
                    const movements = await (tx as any).inventoryTransactionItem.findMany({
                        where: {
                            transaction: {
                                referenceId: stockReq.requestNr,
                                type: 'TRANSFER_OUT',
                                storeId: stockReq.toStoreId as string // The Main Store (source)
                            },
                            itemId: alloc.itemId
                        },
                        orderBy: { quantity: 'asc' } // Most negative first
                    });

                    const transactionItems = [];
                    let remainingToReceive = receivedQty;

                    for (const m of movements) {
                        if (remainingToReceive <= 0) break;
                        const issuedForThisBatch = Math.abs(m.quantity);
                        const take = Math.min(issuedForThisBatch, remainingToReceive);
                        const batchId = (m as any).batchId;

                        if (!batchId) continue;

                        // Add to Sub Store Batch Stock
                        await (tx as any).inventoryBatchStock.upsert({
                            where: { storeId_batchId: { storeId: stockReq.fromStoreId!, batchId } },
                            update: { quantity: { increment: take } },
                            create: {
                                storeId: stockReq.fromStoreId!,
                                batchId,
                                itemId: alloc.itemId,
                                quantity: take
                            }
                        });

                        transactionItems.push({
                            itemId: alloc.itemId,
                            batchId,
                            quantity: take
                        });

                        remainingToReceive = this.round(remainingToReceive - take);
                    }

                    // C. Update Global Sub Store Stock (Legacy)
                    await (tx as any).inventoryStock.upsert({
                        where: {
                            storeId_itemId: {
                                storeId: stockReq.fromStoreId!,
                                itemId: alloc.itemId
                            }
                        },
                        update: { quantity: { increment: receivedQty } },
                        create: {
                            storeId: stockReq.fromStoreId!,
                            itemId: alloc.itemId,
                            quantity: receivedQty
                        }
                    });

                    // D. Log TRANSFER_IN transaction with Batch Details
                    await (tx as any).inventoryTransaction.create({
                        data: {
                            type: 'TRANSFER_IN',
                            storeId: stockReq.fromStoreId!,
                            referenceId: stockReq.requestNr,
                            userId: approvedById || 'SYSTEM',
                            notes: `Received from Main Store - Request ${stockReq.requestNr}`,
                            items: {
                                create: transactionItems.map((ti: any) => ({
                                    itemId: ti.itemId,
                                    batchId: ti.batchId,
                                    quantity: ti.quantity
                                }))
                            }
                        }
                    });
                }

                // Determine completion status
                const isFullyReceived = totalReceived >= totalIssued;
                const finalStatus = isFullyReceived ? 'COMPLETED' : 'PARTIALLY_COMPLETED';

                const updated = await (tx as any).stockRequest.update({
                    where: { id: requestId },
                    data: {
                        status: finalStatus,
                        workflowStage: 'COMPLETED',
                        receivedById: approvedById,
                        receivedDate: new Date(),
                        receivedRemarks: remarks
                    }
                });

                // Notify Main Store / Requester about completion
                try {
                    await NotificationService.send({
                        userId: updated.requestedById,
                        title: 'Stock Request Completed',
                        message: `Your request ${updated.requestNr} has been fully received and stock updated.`,
                        type: 'INVENTORY',
                        priority: 'MEDIUM',
                        link: '/admin/inventory/requests'
                    });
                } catch (nErr) {
                    console.error("Failed to notify completion:", nErr);
                }

                return updated;
            });
        }


        throw new Error('INVALID_ACTION');
    }

    // --- MATERIAL RETURNS (CONTRACTOR) ---

    static async createMaterialReturn(data: {
        contractorId: string;
        storeId: string;
        month: string;
        reason?: string;
        items: { itemId: string; quantity: string; unit?: string; condition?: string }[];
        userId: string;
    }) {
        const { contractorId, storeId, month, reason, items, userId } = data;

        if (!contractorId || !storeId || !month || !items || !Array.isArray(items) || items.length === 0) {
            throw new Error('MISSING_FIELDS');
        }

        return await prisma.$transaction(async (tx) => {
            // 1. Create Return Record
            const returnRecord = await (tx as any).contractorMaterialReturn.create({
                data: {
                    contractorId,
                    storeId,
                    month,
                    reason,
                    status: 'ACCEPTED', // Auto-accepted for now based on logic
                    acceptedBy: userId,
                    acceptedAt: new Date(),
                    items: {
                        create: items.map((item: any) => ({
                            itemId: item.itemId,
                            quantity: parseFloat(item.quantity),
                            unit: item.unit || 'Nos',
                            condition: item.condition || 'GOOD'
                        }))
                    }
                }
            });

            // 2. FIFO Stock Deduction from Contractor & Add to Store
            for (const item of items) {
                const qty = this.round(parseFloat(item.quantity));
                if (qty <= 0) continue;

                // A. FIFO Deduction from Contractor
                const pickedBatches = await InventoryService.pickContractorBatchesFIFO(tx, contractorId, item.itemId, qty);

                for (const picked of pickedBatches) {
                    // Update Contractor Batch Stock
                    await (tx as any).contractorBatchStock.update({
                        where: { contractorId_batchId: { contractorId, batchId: picked.batchId } },
                        data: { quantity: { decrement: picked.quantity } }
                    });

                    // (Only for GOOD items) Add back to Store Stock
                    if (item.condition === 'GOOD') {
                        // Create a special return batch in Store to keep it simple but trackable
                        // OR: Put it back into the same batch in Store Batch Stock
                        await (tx as any).inventoryBatchStock.upsert({
                            where: { storeId_batchId: { storeId, batchId: picked.batchId } },
                            update: { quantity: { increment: picked.quantity } },
                            create: {
                                storeId,
                                batchId: picked.batchId,
                                itemId: item.itemId,
                                quantity: picked.quantity
                            }
                        });
                    }
                }

                // B. Update Global Stock Balances
                // 1. Always Reduce Contractor Total Stock
                await (tx as any).contractorStock.update({
                    where: { contractorId_itemId: { contractorId, itemId: item.itemId } },
                    data: { quantity: { decrement: qty } }
                });

                // 2. (Only for GOOD items) Increase Store Total Stock
                if (item.condition === 'GOOD') {
                    await (tx as any).inventoryStock.upsert({
                        where: { storeId_itemId: { storeId, itemId: item.itemId } },
                        update: { quantity: { increment: qty } },
                        create: { storeId, itemId: item.itemId, quantity: qty }
                    });
                }

                // C. Log Transaction for Store
                await (tx as any).inventoryTransaction.create({
                    data: {
                        type: 'RETURN',
                        storeId,
                        referenceId: returnRecord.id,
                        userId: userId || 'SYSTEM',
                        notes: `Returned from contractor ${contractorId}: ${item.condition}`,
                        items: {
                            create: [{
                                itemId: item.itemId,
                                quantity: item.condition === 'GOOD' ? qty : 0 // Only GOOD items affect store stock availability
                            }]
                        }
                    }
                });
            }

            return returnRecord;
        });
    }

    static async getMaterialReturns(filters: {
        contractorId?: string;
        storeId?: string;
        month?: string;
    }) {
        const whereClause: any = {};
        if (filters.contractorId) whereClause.contractorId = filters.contractorId;
        if (filters.storeId) whereClause.storeId = filters.storeId;
        if (filters.month) whereClause.month = filters.month;

        return await prisma.contractorMaterialReturn.findMany({
            where: whereClause,
            include: {
                store: { select: { name: true } },
                contractor: { select: { name: true } },
                items: {
                    include: {
                        item: { select: { name: true, code: true } }
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });
    }

    // --- BALANCE SHEET ---

    static async saveBalanceSheet(data: {
        contractorId: string;
        storeId: string;
        month: string;
        items: any[];
        userId: string;
    }) {
        const { contractorId, storeId, month, items, userId } = data;

        if (!contractorId || !storeId || !month || !items) {
            throw new Error('MISSING_FIELDS');
        }

        return await prisma.$transaction(async (tx) => {
            // Check if exists
            const existing = await (tx as any).contractorMaterialBalanceSheet.findUnique({
                where: {
                    contractorId_storeId_month: {
                        contractorId,
                        storeId,
                        month
                    }
                }
            });

            if (existing) {
                // Delete old items
                await (tx as any).contractorBalanceSheetItem.deleteMany({
                    where: { balanceSheetId: existing.id }
                });

                // Update Header
                return await (tx as any).contractorMaterialBalanceSheet.update({
                    where: { id: existing.id },
                    data: {
                        generatedAt: new Date(),
                        generatedBy: userId,
                        items: {
                            create: items.map((item: any) => ({
                                itemId: item.itemId,
                                openingBalance: item.opening,
                                received: item.received,
                                returned: item.returned,
                                used: item.used,
                                wastage: item.wastage,
                                closingBalance: item.closing
                            }))
                        }
                    }
                });
            } else {
                // Create New
                return await (tx as any).contractorMaterialBalanceSheet.create({
                    data: {
                        contractorId,
                        storeId,
                        month,
                        generatedBy: userId,
                        items: {
                            create: items.map((item: any) => ({
                                itemId: item.itemId,
                                openingBalance: item.opening,
                                received: item.received,
                                returned: item.returned,
                                used: item.used,
                                wastage: item.wastage,
                                closingBalance: item.closing
                            }))
                        }
                    }
                });
            }
        });
    }

    // --- STOCK ISSUES (GENERIC) ---

    static async createStockIssue(data: {
        storeId: string;
        issuedById: string;
        issueType: string;
        projectId?: string;
        contractorId?: string;
        teamId?: string;
        recipientName: string;
        remarks?: string;
        items: { itemId: string; quantity: string; remarks?: string }[];
    }) {
        const { storeId, issuedById, issueType, projectId, contractorId, teamId, recipientName, remarks, items } = data;

        if (!storeId || !issuedById || !recipientName || !items || items.length === 0) {
            throw new Error('MISSING_FIELDS');
        }

        return await prisma.$transaction(async (tx) => {
            // 1. Generate Issue Number
            const issueNumber = `ISS-${Date.now()}`;

            // 2. Validate and Deduct Stock
            for (const item of items) {
                const quantity = parseFloat(item.quantity);

                // Use InventoryStock to match existing Service logic
                const existingStock = await (tx as any).inventoryStock.findUnique({
                    where: {
                        storeId_itemId: { storeId, itemId: item.itemId }
                    }
                });

                if (!existingStock || existingStock.quantity < quantity) {
                    throw new Error(`INSUFFICIENT_STOCK: ${item.itemId}`);
                }

                await (tx as any).inventoryStock.update({
                    where: {
                        storeId_itemId: { storeId, itemId: item.itemId }
                    },
                    data: { quantity: { decrement: quantity } }
                });

                // Create Movement
                // Note: Ensure StockMovement model exists and fields match
                // If StockMovement does not exist in schema or differs, we might skip or adjust.
                // Assuming implicit compatibility with previous route logic which used StockMovement.
                // Re-checking Schema for StockMovement... Schema had StockMovement at line 1108.
                await (tx as any).stockMovement.create({
                    data: {
                        storeId,
                        itemId: item.itemId,
                        type: 'OUT',
                        quantity,
                        reference: issueNumber,
                        remarks: `Issued to ${recipientName} - ${issueType}`
                    }
                });
            }

            // 3. Create Issue Record
            const issue = await (tx as any).stockIssue.create({
                data: {
                    issueNumber,
                    storeId,
                    issuedById,
                    issueType,
                    projectId: projectId || null,
                    contractorId: contractorId || null,
                    teamId: teamId || null,
                    recipientName,
                    remarks: remarks || null,
                    items: {
                        create: items.map((item: any) => ({
                            itemId: item.itemId,
                            quantity: parseFloat(item.quantity),
                            remarks: item.remarks || null
                        }))
                    }
                },
                include: { items: true }
            });

            return issue;
        });
    }

    static async getStockIssues(filters: {
        storeId?: string;
        issueType?: string;
    }) {
        const where: any = {};
        if (filters.storeId && filters.storeId !== 'unassigned') where.storeId = filters.storeId;
        if (filters.issueType) where.issueType = filters.issueType;

        return await prisma.stockIssue.findMany({
            where,
            include: {
                items: { include: { item: true } },
                issuedBy: { select: { id: true, name: true } },
                project: { select: { id: true, name: true } },
                contractor: { select: { id: true, name: true } }
            },
            orderBy: { createdAt: 'desc' }
        });
    }
}
