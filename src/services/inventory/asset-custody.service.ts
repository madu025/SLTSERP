import { prisma } from '@/lib/prisma';
import { TransactionClient } from './types';

export class AssetCustodyService {
    /**
     * Assign a serialized asset to a staff member
     */
    static async assignAsset(
        serialNumber: string,
        staffId: string,
        userId: string,
        tx?: TransactionClient
    ) {
        const client = tx || prisma;

        // 1. Verify staff exists
        const staff = await client.staff.findUnique({
            where: { id: staffId }
        });
        if (!staff) throw new Error("STAFF_NOT_FOUND");

        // 2. Verify serial exists
        const serial = await client.inventoryItemSerial.findUnique({
            where: { serialNumber }
        });
        if (!serial) throw new Error("SERIAL_NOT_FOUND");

        // 2.5 If the serial was located in a store, decrement stock counts
        if (serial.storeId) {
            const storeId = serial.storeId;
            const itemId = serial.itemId;

            await client.inventoryStock.update({
                where: { storeId_itemId: { storeId, itemId } },
                data: { quantity: { decrement: 1 } }
            });

            const { StockService } = await import('./stock.service');
            const pickedBatches = await StockService.pickStoreBatchesFIFO(client as TransactionClient, storeId, itemId, 1);
            for (const picked of pickedBatches) {
                if (picked.batchId) {
                    await client.inventoryBatchStock.update({
                        where: { storeId_batchId: { storeId, batchId: picked.batchId } },
                        data: { quantity: { decrement: picked.quantity } }
                    });
                }
            }
        }

        // 3. Update serial status and assignee
        const updated = await client.inventoryItemSerial.update({
            where: { serialNumber },
            data: {
                status: 'ASSIGNED',
                assignedStaffId: staffId,
                storeId: null, // Clear store custody
                contractorId: null, // Clear contractor custody
                sodId: null
            }
        });

        // 4. Log audit log
        await client.auditLog.create({
            data: {
                userId,
                action: 'ASSIGN_ASSET',
                entity: 'InventoryItemSerial',
                entityId: serial.id,
                newValue: { staffId, serialNumber, staffName: staff.name }
            }
        });

        return updated;
    }

    /**
     * Transfer custody of a serial from one staff member to another
     */
    static async handoverAsset(
        serialNumber: string,
        fromStaffId: string,
        toStaffId: string,
        userId: string,
        tx?: TransactionClient
    ) {
        const client = tx || prisma;

        // 1. Verify destination staff exists
        const toStaff = await client.staff.findUnique({
            where: { id: toStaffId }
        });
        if (!toStaff) throw new Error("DESTINATION_STAFF_NOT_FOUND");

        // 2. Verify serial is currently assigned to source staff
        const serial = await client.inventoryItemSerial.findFirst({
            where: { serialNumber, assignedStaffId: fromStaffId }
        });
        if (!serial) throw new Error("SERIAL_NOT_ASSIGNED_TO_SOURCE_STAFF");

        // 3. Update assignee
        const updated = await client.inventoryItemSerial.update({
            where: { id: serial.id },
            data: {
                assignedStaffId: toStaffId,
                status: 'ASSIGNED'
            }
        });

        // 4. Log audit log
        await client.auditLog.create({
            data: {
                userId,
                action: 'HANDOVER_ASSET',
                entity: 'InventoryItemSerial',
                entityId: serial.id,
                oldValue: { staffId: fromStaffId },
                newValue: { staffId: toStaffId, serialNumber, destinationStaffName: toStaff.name }
            }
        });

        return updated;
    }

    /**
     * Retire or mark a serialized asset as faulty/returned to store
     */
    static async retireAsset(
        serialNumber: string,
        status: 'IN_STORE' | 'FAULTY',
        storeId: string | null,
        userId: string,
        tx?: TransactionClient
    ) {
        const client = tx || prisma;

        // 1. Verify serial exists
        const serial = await client.inventoryItemSerial.findUnique({
            where: { serialNumber }
        });
        if (!serial) throw new Error("SERIAL_NOT_FOUND");

        // 2. If storeId is provided, verify store exists
        if (storeId) {
            const store = await client.inventoryStore.findUnique({
                where: { id: storeId }
            });
            if (!store) throw new Error("STORE_NOT_FOUND");
        }

        // 2.5 If returning/retiring to store, increment stock counts
        if (status === 'IN_STORE' && storeId && serial.status !== 'IN_STORE') {
            const itemId = serial.itemId;

            await client.inventoryStock.upsert({
                where: { storeId_itemId: { storeId, itemId } },
                update: { quantity: { increment: 1 } },
                create: { storeId, itemId, quantity: 1 }
            });

            const latestBatchStock = await client.inventoryBatchStock.findFirst({
                where: { storeId, itemId },
                orderBy: { updatedAt: 'desc' }
            });

            let batchId = latestBatchStock?.batchId;
            if (!batchId) {
                const itemData = await client.inventoryItem.findUnique({ where: { id: itemId } });
                const batch = await client.inventoryBatch.create({
                    data: {
                        batchNumber: `RET-${Date.now()}`,
                        itemId,
                        initialQty: 1,
                        costPrice: itemData?.costPrice || 0,
                        unitPrice: itemData?.unitPrice || 0
                    }
                });
                batchId = batch.id;
            }

            await client.inventoryBatchStock.upsert({
                where: { storeId_batchId: { storeId, batchId } },
                update: { quantity: { increment: 1 } },
                create: { storeId, batchId, itemId, quantity: 1 }
            });
        }

        // 3. Update serial status, clear staff assignment
        const updated = await client.inventoryItemSerial.update({
            where: { id: serial.id },
            data: {
                status,
                assignedStaffId: null,
                storeId: storeId || null,
                contractorId: null,
                sodId: null
            }
        });

        // 4. Log audit
        await client.auditLog.create({
            data: {
                userId,
                action: status === 'FAULTY' ? 'RETIRE_ASSET_FAULTY' : 'RETURN_ASSET_TO_STORE',
                entity: 'InventoryItemSerial',
                entityId: serial.id,
                oldValue: { assignedStaffId: serial.assignedStaffId, status: serial.status },
                newValue: { status, storeId }
            }
        });

        return updated;
    }
}
