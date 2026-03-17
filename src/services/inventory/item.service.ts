import { InventoryRepository } from '@/repositories/inventory.repository';
import { ContractorRepository } from '@/repositories/contractor.repository';
import { Prisma, InventoryItem } from '@prisma/client';
import { emitSystemEvent } from '@/lib/events';
import { CreateItemData, TransactionClient } from './types';
import { prisma } from '@/lib/prisma';

export class ItemService {
    /**
     * Fetch all items with optional filtering (Context-based)
     */
    static async getItems(context?: string): Promise<InventoryItem[]> {
        // Use repository to fetch all items
        let items: InventoryItem[] = await InventoryRepository.findItemsRaw();

        if (context === 'OSP_FTTH') {
            const config = await InventoryRepository.findSystemConfig('OSP_MATERIAL_SOURCE');
            const source = config?.value || 'SLT';

            items = items.filter((item: InventoryItem) => {
                if (!item.isOspFtth) return false;
                return source === 'SLT' ? item.type === 'SLT' : item.type !== 'SLT';
            });
        }

        return items;
    }

    static async createItem(data: CreateItemData): Promise<InventoryItem> {
        if (!data.code || !data.name || !data.commonName) {
            throw new Error('CODE_NAME_AND_GENERIC_NAME_REQUIRED');
        }

        try {
            const item = await InventoryRepository.createItem({
                code: data.code,
                name: data.name,
                description: data.description,
                unit: data.unit || 'Nos',
                type: (data.type as any) || 'SLTS',
                category: data.category || 'OTHERS',
                commonFor: data.commonFor || ['FTTH', 'PSTN', 'OSP', 'OTHERS'],
                minLevel: data.minLevel ? parseFloat(data.minLevel.toString()) : 0,
                unitPrice: data.unitPrice ? parseFloat(data.unitPrice.toString()) : 0,
                costPrice: data.costPrice ? parseFloat(data.costPrice.toString()) : 0,
                isWastageAllowed: data.isWastageAllowed !== undefined ? data.isWastageAllowed : true,
                maxWastagePercentage: data.maxWastagePercentage ? parseFloat(data.maxWastagePercentage.toString()) : 0,
                isOspFtth: data.isOspFtth || false,
                hasSerial: data.hasSerial || false,
                commonName: data.commonName,
                sltCode: data.sltCode,
                importAliases: data.importAliases || []
            });

            emitSystemEvent('INVENTORY_UPDATE');
            return item;
        } catch (error: any) {
            if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
                throw new Error('ITEM_EXISTS');
            }
            throw error;
        }
    }

    static async updateItem(id: string, data: Partial<CreateItemData>): Promise<InventoryItem> {
        if (!id) throw new Error('ID_REQUIRED');

        const updated = await InventoryRepository.updateItem(id, {
            name: data.name,
            description: data.description,
            unit: data.unit,
            type: data.type as any,
            category: data.category,
            commonFor: data.commonFor,
            minLevel: data.minLevel ? parseFloat(data.minLevel.toString()) : undefined,
            unitPrice: data.unitPrice ? parseFloat(data.unitPrice.toString()) : undefined,
            costPrice: data.costPrice ? parseFloat(data.costPrice.toString()) : undefined,
            isWastageAllowed: data.isWastageAllowed,
            maxWastagePercentage: data.maxWastagePercentage ? parseFloat(data.maxWastagePercentage.toString()) : undefined,
            isOspFtth: data.isOspFtth,
            hasSerial: data.hasSerial,
            commonName: data.commonName,
            sltCode: data.sltCode,
            importAliases: data.importAliases
        });

        emitSystemEvent('INVENTORY_UPDATE');
        return updated;
    }

    static async patchBulkItems(updates: { id: string; data: Partial<CreateItemData> }[]): Promise<boolean> {
        if (!Array.isArray(updates)) throw new Error('UPDATES_MUST_BE_ARRAY');

        await prisma.$transaction(async (tx: TransactionClient) => {
            for (const u of updates) {
                await InventoryRepository.updateItem(u.id, u.data as Prisma.InventoryItemUpdateInput, tx);
            }
        });

        emitSystemEvent('INVENTORY_UPDATE');
        return true;
    }

    static async mergeItems(sourceId: string, targetId: string): Promise<boolean> {
        if (!sourceId || !targetId) throw new Error('BOTH_IDS_REQUIRED');
        if (sourceId === targetId) throw new Error('CANNOT_MERGE_SAME_ITEM');

        const source = await InventoryRepository.findItemById(sourceId);
        const target = await InventoryRepository.findItemById(targetId);
        if (!source || !target) throw new Error('ITEM_NOT_FOUND');

        await prisma.$transaction(async (tx: TransactionClient) => {
            // 2. Transfer ContractorStock
            const sourceContractorStock = await (tx as any).contractorStock.findMany({ where: { itemId: sourceId } });
            for (const stock of sourceContractorStock) {
                await ContractorRepository.upsertStock(stock.contractorId, targetId, stock.quantity, tx);
            }
            await (tx as any).contractorStock.deleteMany({ where: { itemId: sourceId } });

            // 3. Transfer InventoryStock
            const sourceInventoryStock = await (tx as any).inventoryStock.findMany({ where: { itemId: sourceId } });
            for (const stock of sourceInventoryStock) {
                await InventoryRepository.upsertStock(stock.storeId, targetId, stock.quantity, tx);
            }
            await (tx as any).inventoryStock.deleteMany({ where: { itemId: sourceId } });

            // 4. Transfer Batches and Batch Stocks
            await (tx as any).inventoryBatch.updateMany({ where: { itemId: sourceId }, data: { itemId: targetId } });
            await (tx as any).inventoryBatchStock.updateMany({ where: { itemId: sourceId }, data: { itemId: targetId } });
            await (tx as any).contractorBatchStock.updateMany({ where: { itemId: sourceId }, data: { itemId: targetId } });

            // 5. Transfer History/Usage (ID UPDATE)
            await (tx as any).sODMaterialUsage.updateMany({ where: { itemId: sourceId }, data: { itemId: targetId } });
            await (tx as any).stockRequestItem.updateMany({ where: { itemId: sourceId }, data: { itemId: targetId } });
            await (tx as any).stockIssueItem.updateMany({ where: { itemId: sourceId }, data: { itemId: targetId } });
            await (tx as any).gRNItem.updateMany({ where: { itemId: sourceId }, data: { itemId: targetId } });
            await (tx as any).mRNItem.updateMany({ where: { itemId: sourceId }, data: { itemId: targetId } });
            await (tx as any).inventoryTransactionItem.updateMany({ where: { itemId: sourceId }, data: { itemId: targetId } });
            await (tx as any).contractorMaterialIssueItem.updateMany({ where: { itemId: sourceId }, data: { itemId: targetId } });
            await (tx as any).contractorMaterialReturnItem.updateMany({ where: { itemId: sourceId }, data: { itemId: targetId } });
            await (tx as any).projectMaterialReturnItem.updateMany({ where: { itemId: sourceId }, data: { itemId: targetId } });
            await (tx as any).contractorWastageItem.updateMany({ where: { itemId: sourceId }, data: { itemId: targetId } });
            await (tx as any).projectBOQItem.updateMany({ where: { materialId: sourceId }, data: { materialId: targetId } });

            // 6. Update Aliases on Target
            const mergedAliases = Array.from(new Set([
                ...(target.importAliases || []),
                source.code,
                ...(source.sltCode ? [source.sltCode] : []),
                ...(source.importAliases || [])
            ])).filter(Boolean);

            await InventoryRepository.updateItem(targetId, {
                importAliases: mergedAliases,
                commonName: target.commonName || source.commonName,
                sltCode: target.sltCode || source.sltCode
            }, tx);

            // 7. Delete Source Item
            await InventoryRepository.deleteItem(sourceId, tx);
        });

        emitSystemEvent('INVENTORY_UPDATE');
        return true;
    }

    static async deleteItem(id: string): Promise<boolean> {
        if (!id) throw new Error('ID_REQUIRED');
        await InventoryRepository.deleteItem(id);
        emitSystemEvent('INVENTORY_UPDATE');
        return true;
    }
}
