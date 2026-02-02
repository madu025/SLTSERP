import { prisma } from '@/lib/prisma';
import { Prisma, InventoryItem } from '@prisma/client';
import { emitSystemEvent } from '@/lib/events';
import { CreateItemData } from './types';

export class ItemService {
    /**
     * Fetch all items with optional filtering (Context-based)
     */
    static async getItems(context?: string): Promise<InventoryItem[]> {
        // Use raw query to fetch all fields to bypass potential stale client issues
        let items: InventoryItem[] = await prisma.$queryRaw`SELECT * FROM "InventoryItem" ORDER BY "code" ASC`;

        if (context === 'OSP_FTTH') {
            const configs: { value: string }[] = await prisma.$queryRaw`SELECT value FROM "SystemConfig" WHERE key = 'OSP_MATERIAL_SOURCE' LIMIT 1`;
            const source = configs[0]?.value || 'SLT';

            items = items.filter((item: InventoryItem) => {
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

    static async createItem(data: CreateItemData): Promise<InventoryItem> {
        if (!data.code || !data.name || !data.commonName) {
            throw new Error('CODE_NAME_AND_GENERIC_NAME_REQUIRED');
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
                    minLevel: data.minLevel ? parseFloat(data.minLevel.toString()) : 0,
                    unitPrice: data.unitPrice ? parseFloat(data.unitPrice.toString()) : 0,
                    costPrice: data.costPrice ? parseFloat(data.costPrice.toString()) : 0,
                    isWastageAllowed: data.isWastageAllowed !== undefined ? data.isWastageAllowed : true,
                    maxWastagePercentage: data.maxWastagePercentage ? parseFloat(data.maxWastagePercentage.toString()) : 0,
                    isOspFtth: data.isOspFtth || false,
                    commonName: data.commonName,
                    sltCode: data.sltCode,
                    importAliases: data.importAliases || []
                } as unknown as Prisma.InventoryItemCreateInput
            });

            emitSystemEvent('INVENTORY_UPDATE');
            return item;
        } catch (error: unknown) {
            if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
                throw new Error('ITEM_EXISTS');
            }
            throw error;
        }
    }

    static async updateItem(id: string, data: Partial<CreateItemData>): Promise<InventoryItem> {
        if (!id) throw new Error('ID_REQUIRED');

        const updated = await prisma.inventoryItem.update({
            where: { id },
            data: {
                name: data.name,
                description: data.description,
                unit: data.unit,
                type: data.type,
                category: data.category,
                commonFor: data.commonFor,
                minLevel: data.minLevel ? parseFloat(data.minLevel.toString()) : undefined,
                unitPrice: data.unitPrice ? parseFloat(data.unitPrice.toString()) : undefined,
                costPrice: data.costPrice ? parseFloat(data.costPrice.toString()) : undefined,
                isWastageAllowed: data.isWastageAllowed,
                maxWastagePercentage: data.maxWastagePercentage ? parseFloat(data.maxWastagePercentage.toString()) : undefined,
                isOspFtth: data.isOspFtth,
                commonName: data.commonName,
                sltCode: data.sltCode,
                importAliases: data.importAliases
            } as unknown as Prisma.InventoryItemUpdateInput
        });

        emitSystemEvent('INVENTORY_UPDATE');
        return updated;
    }

    static async patchBulkItems(updates: { id: string; data: Partial<CreateItemData> }[]): Promise<boolean> {
        if (!Array.isArray(updates)) {
            throw new Error('UPDATES_MUST_BE_ARRAY');
        }

        await prisma.$transaction(
            updates.map((update) =>
                prisma.inventoryItem.update({
                    where: { id: update.id },
                    data: update.data as unknown as Prisma.InventoryItemUpdateInput
                })
            )
        );

        emitSystemEvent('INVENTORY_UPDATE');
        return true;
    }

    static async deleteItem(id: string): Promise<boolean> {
        if (!id) throw new Error('ID_REQUIRED');

        await prisma.inventoryItem.delete({
            where: { id }
        });

        emitSystemEvent('INVENTORY_UPDATE');
        return true;
    }
}
