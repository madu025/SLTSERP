import { AppError } from '@/lib/error';
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
            throw AppError.badRequest('CODE_NAME_AND_GENERIC_NAME_REQUIRED');
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
                throw AppError.badRequest('ITEM_EXISTS');
            }
            throw error;
        }
    }

    static async updateItem(id: string, data: Partial<CreateItemData>): Promise<InventoryItem> {
        if (!id) throw AppError.badRequest('ID_REQUIRED');

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

    static async patchBulkItems(updates: any[]): Promise<boolean> {
        if (!Array.isArray(updates)) throw AppError.badRequest('UPDATES_MUST_BE_ARRAY');

        await prisma.$transaction(async (tx: TransactionClient) => {
            for (const u of updates) {
                const itemId = u.id;
                const updateData = u.data ? u.data : {
                    isOspFtth: u.isOspFtth,
                    type: u.type,
                    commonName: u.commonName,
                    commonFor: u.tags || u.commonFor
                };

                if (itemId) {
                    await tx.inventoryItem.update({
                        where: { id: itemId },
                        data: updateData
                    });
                }
            }
        });

        emitSystemEvent('INVENTORY_UPDATE');
        return true;
    }

    static async mergeItems(sourceId: string, targetId: string): Promise<boolean> {
        if (!sourceId || !targetId) throw AppError.badRequest('BOTH_IDS_REQUIRED');
        if (sourceId === targetId) throw AppError.badRequest('CANNOT_MERGE_SAME_ITEM');

        const source = await InventoryRepository.findItemById(sourceId);
        const target = await InventoryRepository.findItemById(targetId);
        if (!source || !target) throw AppError.badRequest('ITEM_NOT_FOUND');

        await prisma.$transaction(async (tx: TransactionClient) => {
            const sourceContractorStock = await tx.contractorStock.findMany({ where: { itemId: sourceId } });
            for (const stock of sourceContractorStock) {
                await ContractorRepository.upsertStock(stock.contractorId, targetId, Number(stock.quantity), tx);
            }
            await tx.contractorStock.deleteMany({ where: { itemId: sourceId } });

            const sourceInventoryStock = await tx.inventoryStock.findMany({ where: { itemId: sourceId } });
            for (const stock of sourceInventoryStock) {
                await InventoryRepository.upsertStock(stock.storeId, targetId, Number(stock.quantity), tx);
            }
            await tx.inventoryStock.deleteMany({ where: { itemId: sourceId } });

            await tx.inventoryBatch.updateMany({ where: { itemId: sourceId }, data: { itemId: targetId } });
            await tx.inventoryBatchStock.updateMany({ where: { itemId: sourceId }, data: { itemId: targetId } });
            await tx.contractorBatchStock.updateMany({ where: { itemId: sourceId }, data: { itemId: targetId } });

            await tx.sODMaterialUsage.updateMany({ where: { itemId: sourceId }, data: { itemId: targetId } });
            await tx.stockRequestItem.updateMany({ where: { itemId: sourceId }, data: { itemId: targetId } });
            await tx.stockIssueItem.updateMany({ where: { itemId: sourceId }, data: { itemId: targetId } });
            await tx.gRNItem.updateMany({ where: { itemId: sourceId }, data: { itemId: targetId } });
            await tx.mRNItem.updateMany({ where: { itemId: sourceId }, data: { itemId: targetId } });
            await tx.inventoryTransactionItem.updateMany({ where: { itemId: sourceId }, data: { itemId: targetId } });
            await tx.contractorMaterialIssueItem.updateMany({ where: { itemId: sourceId }, data: { itemId: targetId } });
            await tx.contractorMaterialReturnItem.updateMany({ where: { itemId: sourceId }, data: { itemId: targetId } });
            await tx.projectMaterialReturnItem.updateMany({ where: { itemId: sourceId }, data: { itemId: targetId } });
            await tx.contractorWastageItem.updateMany({ where: { itemId: sourceId }, data: { itemId: targetId } });
            await tx.projectBOQItem.updateMany({ where: { materialId: sourceId }, data: { materialId: targetId } });

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

            await InventoryRepository.deleteItem(sourceId, tx);
        });

        emitSystemEvent('INVENTORY_UPDATE');
        return true;
    }

    static async deleteItem(id: string): Promise<boolean> {
        if (!id) throw AppError.badRequest('ID_REQUIRED');
        await InventoryRepository.deleteItem(id);
        emitSystemEvent('INVENTORY_UPDATE');
        return true;
    }
}
