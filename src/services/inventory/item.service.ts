import { AppError } from '@/lib/error';
import { InventoryRepository } from '@/repositories/inventory.repository';
import { ContractorRepository } from '@/repositories/contractor.repository';
import { Prisma, InventoryItem } from '@prisma/client';
import { safe } from '@/utils/safe-await.util';
import { emitSystemEvent } from '@/lib/events';
import { CreateItemData, TransactionClient } from '@/types/inventory/inventory-service.types';
import { prisma } from '@/lib/prisma';

/** Normalize alias arrays for exact-match storage: trim + uppercase, drop blanks, dedupe. */
function normalizeAliases(aliases?: string[]): string[] | undefined {
    if (aliases === undefined) return undefined;
    return Array.from(new Set(
        (aliases || []).map(a => (a || '').trim().toUpperCase()).filter(Boolean)
    ));
}

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

        const [error, item] = await safe(InventoryRepository.createItem({
            code: data.code,
            name: data.name,
            description: data.description,
            unit: data.unit || 'Nos',
            type: (data.type as unknown as Prisma.InventoryItemCreateInput['type']) || 'SLTS',
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
            importAliases: normalizeAliases(data.importAliases) || [],
            scrapedAliases: normalizeAliases(data.scrapedAliases) || [],
            bomAliases: normalizeAliases(data.bomAliases) || []
        }));

        if (error) {
            if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
                throw AppError.badRequest('ITEM_EXISTS');
            }
            throw error;
        }

        if (item) {
            emitSystemEvent('INVENTORY_UPDATE');
            return item;
        }
        
        throw AppError.internal('Failed to create item');
    }

    static async updateItem(id: string, data: Partial<CreateItemData>): Promise<InventoryItem> {
        if (!id) throw AppError.badRequest('ID_REQUIRED');

        const updated = await InventoryRepository.updateItem(id, {
            name: data.name,
            description: data.description,
            unit: data.unit,
            type: data.type as unknown as Prisma.InventoryItemUpdateInput['type'],
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
            importAliases: normalizeAliases(data.importAliases),
            scrapedAliases: normalizeAliases(data.scrapedAliases),
            bomAliases: normalizeAliases(data.bomAliases)
        });

        emitSystemEvent('INVENTORY_UPDATE');
        return updated;
    }

    static async patchBulkItems(updates: Record<string, unknown>[]): Promise<boolean> {
        if (!Array.isArray(updates)) throw AppError.badRequest('UPDATES_MUST_BE_ARRAY');

        await prisma.$transaction(async (tx: TransactionClient) => {
            for (const u of updates) {
                const itemId = u.id as string | undefined;
                const source = (u.data ? u.data : u) as Record<string, unknown>;
                // Whitelist allowed bulk-patch fields (no raw pass-through)
                const updateData: Record<string, unknown> = {
                    isOspFtth: source.isOspFtth,
                    type: source.type,
                    category: source.category,
                    commonName: source.commonName,
                    commonFor: source.tags || source.commonFor
                };
                if (source.importAliases !== undefined && source.importAliases !== null) updateData.importAliases = normalizeAliases(source.importAliases as string[]);
                if (source.scrapedAliases !== undefined && source.scrapedAliases !== null) updateData.scrapedAliases = normalizeAliases(source.scrapedAliases as string[]);
                if (source.bomAliases !== undefined && source.bomAliases !== null) updateData.bomAliases = normalizeAliases(source.bomAliases as string[]);

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
            await tx.preErpMaterialBalance.updateMany({ where: { itemId: sourceId }, data: { itemId: targetId } });

            const mergedAliases = normalizeAliases([
                ...(target.importAliases || []),
                source.code,
                ...(source.sltCode ? [source.sltCode] : []),
                ...(source.importAliases || [])
            ]) || [];

            const mergedScraped = normalizeAliases([
                ...(target.scrapedAliases || []),
                ...(source.scrapedAliases || [])
            ]) || [];

            const mergedBom = normalizeAliases([
                ...(target.bomAliases || []),
                ...(source.bomAliases || [])
            ]) || [];

            await InventoryRepository.updateItem(targetId, {
                importAliases: mergedAliases,
                scrapedAliases: mergedScraped,
                bomAliases: mergedBom,
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

        const item = await InventoryRepository.findItemById(id);
        if (!item) throw AppError.notFound('Item not found');

        // Check for active references before attempting hard delete
        const [preErpCount, stockCount, usageCount] = await Promise.all([
            prisma.preErpMaterialBalance.count({ where: { itemId: id } }),
            prisma.inventoryStock.count({ where: { itemId: id } }),
            prisma.sODMaterialUsage.count({ where: { itemId: id } })
        ]);

        if (preErpCount > 0 || stockCount > 0 || usageCount > 0) {
            throw AppError.badRequest(
                `Cannot delete item '${item.name}' (${item.code}) because it has active stock balance or historical transaction records. Consider merging or editing its configuration instead.`
            );
        }

        const [error] = await safe(InventoryRepository.deleteItem(id));
        if (error) {
            const msg = error instanceof Error ? error.message : String(error);
            if (msg.includes('Foreign key constraint violated') || msg.includes('fkey')) {
                throw AppError.badRequest(
                    `Cannot delete item '${item.name}' (${item.code}) because it is referenced in inventory balances or financial ledgers.`
                );
            }
            throw error;
        }

        emitSystemEvent('INVENTORY_UPDATE');
        return true;
    }
}

