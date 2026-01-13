import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { NotificationService } from './notification.service';
import { AuditService } from './audit.service';

export class InventoryService {

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
                    isWastageAllowed: data.isWastageAllowed !== undefined ? data.isWastageAllowed : true,
                    maxWastagePercentage: data.maxWastagePercentage ? parseFloat(data.maxWastagePercentage) : 0
                }
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
                isWastageAllowed: data.isWastageAllowed,
                maxWastagePercentage: data.maxWastagePercentage ? parseFloat(data.maxWastagePercentage) : 0
            }
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

    /**
     * Initialize or Adjust Stock Levels in Bulk
     */
    static async initializeStock(storeId: string, items: any[], reason?: string, userId?: string) {
        if (!storeId || !Array.isArray(items)) throw new Error('INVALID_PAYLOAD');

        return await prisma.$transaction(async (tx) => {
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
                                quantity: ti.quantity
                            }))
                        }
                    }
                });
            }

            return transactionItems.length;
        });
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
                    include: { item: true }
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

            // 4. Update Request Status if linked
            if (requestId) {
                const request = await tx.stockRequest.findUnique({
                    where: { id: requestId },
                    include: { items: true }
                });

                if (request) {
                    let allItemsCompleted = true;
                    let isPartial = false;

                    // Update received quantities for each item
                    for (const reqItem of request.items) {
                        const grnItem = items.find((gi) => gi.itemId === reqItem.itemId);
                        if (grnItem) {
                            const newReceivedQty = reqItem.receivedQty + parseFloat(grnItem.quantity);

                            await tx.stockRequestItem.update({
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

                    await tx.stockRequest.update({
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
            const materialIssue = await tx.contractorMaterialIssue.create({
                data: {
                    contractorId,
                    storeId,
                    month,
                    issueDate: new Date(),
                    issuedBy: userId || 'SYSTEM',
                    items: {
                        create: items.map((i) => ({
                            itemId: i.itemId,
                            quantity: parseFloat(i.quantity),
                            unit: i.unit || 'Nos'
                        }))
                    }
                }
            });

            // 2. Reduce Stock & Create Transaction Items
            const transactionItems = [];

            for (const item of items) {
                const qty = parseFloat(item.quantity);

                // Reduce Stock
                await tx.inventoryStock.update({
                    where: {
                        storeId_itemId: {
                            storeId,
                            itemId: item.itemId
                        }
                    },
                    data: {
                        quantity: { decrement: qty }
                    }
                });

                transactionItems.push({
                    itemId: item.itemId,
                    quantity: -qty // Negative for issue
                });
            }

            // 3. Create Transaction Log
            await tx.inventoryTransaction.create({
                data: {
                    type: 'MATERIAL_ISSUE',
                    storeId,
                    referenceId: materialIssue.id,
                    userId: userId || 'SYSTEM',
                    notes: `Material issued to contractor ${contractorId} for month ${month}`,
                    items: {
                        create: transactionItems
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
                    await tx.inventoryStock.upsert({
                        where: { storeId_itemId: { storeId: mrn.storeId, itemId: item.itemId } },
                        update: { quantity: { decrement: item.quantity } },
                        create: { storeId: mrn.storeId, itemId: item.itemId, quantity: -item.quantity }
                    });

                    transactionItems.push({
                        itemId: item.itemId,
                        quantity: -item.quantity // Negative for return
                    });
                }

                // Log transaction
                await tx.inventoryTransaction.create({
                    data: {
                        type: 'RETURN',
                        storeId: mrn.storeId,
                        referenceId: mrn.id,
                        userId: approvedById,
                        notes: `MRN ${mrn.mrnNumber} - ${mrn.returnType}`,
                        items: {
                            create: transactionItems.map(ti => ({
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

        // SCENARIO 1: Contractor Wastage (No Store Stock Reduction)
        if (contractorId) {
            if (!storeId) throw new Error('STORE_ID_REQUIRED');

            const wastage = await prisma.contractorWastage.create({
                data: {
                    contractorId,
                    storeId, // Guaranteed string now
                    month: month || new Date().toISOString().slice(0, 7),
                    description: description || reason,
                    items: {
                        create: items.map((item) => ({
                            itemId: item.itemId,
                            quantity: parseFloat(item.quantity),
                            unit: item.unit || 'Nos'
                        }))
                    }
                }
            });

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
        }

        if (!storeId) throw new Error('STORE_ID_REQUIRED_FOR_STORE_WASTAGE');

        // SCENARIO 2: Store Wastage (Reduce Stock)
        return await prisma.$transaction(async (tx) => {
            const transactionItems = [];

            for (const item of items) {
                const qty = parseFloat(item.quantity);
                if (qty <= 0) continue;

                // Reduce Stock
                await tx.inventoryStock.upsert({
                    where: { storeId_itemId: { storeId, itemId: item.itemId } },
                    update: { quantity: { decrement: qty } },
                    create: { storeId, itemId: item.itemId, quantity: -qty }
                });

                transactionItems.push({ itemId: item.itemId, quantity: -qty }); // Negative for reduce
            }

            // Create Transaction Log
            const txRecord = await tx.inventoryTransaction.create({
                data: {
                    type: 'WASTAGE',
                    storeId,
                    userId: userId || 'SYSTEM',
                    referenceId: `STORE-WASTAGE-${Date.now()}`,
                    notes: reason || description,
                    items: {
                        create: transactionItems.map(ti => ({
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
                const stockReq = await tx.stockRequest.findUnique({
                    where: { id: requestId },
                    include: { items: true, fromStore: true, toStore: true }
                });

                if (!stockReq) throw new Error("REQUEST_NOT_FOUND");

                // Update approved quantities if provided
                if (allocation && Array.isArray(allocation)) {
                    for (const alloc of allocation) {
                        await tx.stockRequestItem.updateMany({
                            where: { requestId, itemId: alloc.itemId },
                            data: { approvedQty: parseFloat(alloc.approvedQty) }
                        });
                    }
                }

                // Scenario A: Local Purchase (Any Store)
                // Flow: OSP Approval → Procurement → GRN
                if (stockReq.sourceType === 'LOCAL_PURCHASE') {
                    const updated = await tx.stockRequest.update({
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
                    const updated = await tx.stockRequest.update({
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
                    const updated = await tx.stockRequest.update({
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
                const stockReq = await tx.stockRequest.findUnique({
                    where: { id: requestId },
                    include: { items: true, fromStore: true }
                });

                if (!stockReq) throw new Error("REQUEST_NOT_FOUND");
                if (stockReq.workflowStage !== 'MAIN_STORE_RELEASE') throw new Error("INVALID_WORKFLOW_STAGE");

                // Update issued quantities and deduct from Main Store
                for (const alloc of allocation) {
                    const issuedQty = parseFloat(alloc.issuedQty);

                    // Validate stock availability
                    const stock = await tx.inventoryStock.findUnique({
                        where: {
                            storeId_itemId: {
                                storeId: stockReq.toStoreId!,
                                itemId: alloc.itemId
                            }
                        }
                    });

                    if (!stock || stock.quantity < issuedQty) {
                        throw new Error(`INSUFFICIENT_STOCK: ${alloc.itemId}`);
                    }

                    // Update issued qty in request item
                    await tx.stockRequestItem.updateMany({
                        where: { requestId, itemId: alloc.itemId },
                        data: { issuedQty }
                    });

                    // Deduct from Main Store
                    await tx.inventoryStock.update({
                        where: {
                            storeId_itemId: {
                                storeId: stockReq.toStoreId!,
                                itemId: alloc.itemId
                            }
                        },
                        data: { quantity: { decrement: issuedQty } }
                    });

                    // Log TRANSFER_OUT transaction
                    await tx.inventoryTransaction.create({
                        data: {
                            type: 'TRANSFER_OUT',
                            storeId: stockReq.toStoreId!,
                            referenceId: stockReq.requestNr,
                            userId: approvedById || 'SYSTEM',
                            notes: `Released to ${stockReq.fromStore?.name} - Request ${stockReq.requestNr}`,
                            items: {
                                create: {
                                    itemId: alloc.itemId,
                                    quantity: issuedQty
                                }
                            }
                        }
                    });
                }

                // Update request status
                const updated = await tx.stockRequest.update({
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
                const stockReq = await tx.stockRequest.findUnique({
                    where: { id: requestId },
                    include: { items: true }
                });

                if (!stockReq) throw new Error("REQUEST_NOT_FOUND");
                if (stockReq.workflowStage !== 'SUB_STORE_RECEIVE') throw new Error("INVALID_WORKFLOW_STAGE");

                let totalIssued = 0;
                let totalReceived = 0;

                // Update received quantities and add to Sub Store
                for (const alloc of allocation) {
                    const receivedQty = parseFloat(alloc.receivedQty);
                    const item = stockReq.items.find(i => i.itemId === alloc.itemId);

                    if (!item) continue;

                    totalIssued += item.issuedQty || 0;
                    totalReceived += receivedQty;

                    // Update received qty
                    await tx.stockRequestItem.updateMany({
                        where: { requestId, itemId: alloc.itemId },
                        data: { receivedQty }
                    });

                    // Add to Sub Store
                    await tx.inventoryStock.upsert({
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

                    // Log TRANSFER_IN transaction
                    await tx.inventoryTransaction.create({
                        data: {
                            type: 'TRANSFER_IN',
                            storeId: stockReq.fromStoreId!,
                            referenceId: stockReq.requestNr,
                            userId: approvedById || 'SYSTEM',
                            notes: `Received from Main Store - Request ${stockReq.requestNr}`,
                            items: {
                                create: {
                                    itemId: alloc.itemId,
                                    quantity: receivedQty
                                }
                            }
                        }
                    });
                }

                // Determine completion status
                const isFullyReceived = totalReceived >= totalIssued;
                const finalStatus = isFullyReceived ? 'COMPLETED' : 'PARTIALLY_COMPLETED';

                const updated = await tx.stockRequest.update({
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
            const returnRecord = await tx.contractorMaterialReturn.create({
                data: {
                    contractorId,
                    storeId,
                    month,
                    reason,
                    status: 'ACCEPTED', // Auto-accepted for now based on logic
                    acceptedBy: userId,
                    acceptedAt: new Date(),
                    items: {
                        create: items.map((item) => ({
                            itemId: item.itemId,
                            quantity: parseFloat(item.quantity),
                            unit: item.unit || 'Nos',
                            condition: item.condition || 'GOOD'
                        }))
                    }
                }
            });

            // 2. Update Inventory Stock (Only for GOOD items)
            for (const item of items) {
                const qty = parseFloat(item.quantity);
                if (item.condition === 'GOOD' && qty > 0) {
                    // Update Stock
                    await tx.inventoryStock.upsert({
                        where: {
                            storeId_itemId: {
                                storeId,
                                itemId: item.itemId
                            }
                        },
                        update: { quantity: { increment: qty } },
                        create: {
                            storeId,
                            itemId: item.itemId,
                            quantity: qty,
                        }
                    });
                }
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
            const existing = await tx.contractorMaterialBalanceSheet.findUnique({
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
                await tx.contractorBalanceSheetItem.deleteMany({
                    where: { balanceSheetId: existing.id }
                });

                // Update Header
                return await tx.contractorMaterialBalanceSheet.update({
                    where: { id: existing.id },
                    data: {
                        generatedAt: new Date(),
                        generatedBy: userId,
                        items: {
                            create: items.map((item) => ({
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
                return await tx.contractorMaterialBalanceSheet.create({
                    data: {
                        contractorId,
                        storeId,
                        month,
                        generatedBy: userId,
                        items: {
                            create: items.map((item) => ({
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
                const existingStock = await tx.inventoryStock.findUnique({
                    where: {
                        storeId_itemId: { storeId, itemId: item.itemId }
                    }
                });

                if (!existingStock || existingStock.quantity < quantity) {
                    throw new Error(`INSUFFICIENT_STOCK: ${item.itemId}`);
                }

                await tx.inventoryStock.update({
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
                await tx.stockMovement.create({
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
            const issue = await tx.stockIssue.create({
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
                        create: items.map((item) => ({
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
