import { AppError } from '@/lib/error';
import { prisma } from '@/lib/prisma';

interface CreateBOQItemInput {
    projectId: string;
    itemCode: string;
    description: string;
    unit: string;
    quantity: string | number;
    unitRate: string | number;
    category?: string | null;
    materialId?: string | null;
    remarks?: string | null;
}

interface UpdateBOQItemInput {
    quantity?: string | number;
    unitRate?: string | number;
    actualQuantity?: string | number;
    actualCost?: string | number;
    category?: string | null;
    materialId?: string | null;
    remarks?: string | null;
    description?: string;
    unit?: string;
}

interface SaveBOQRateInput {
    itemCode: string;
    description?: string;
    unit?: string;
    unitRate: string | number;
    itemCategory?: string;
    projectId?: string | null;
    isActive?: boolean;
}

interface BulkRateInput {
    itemCode: string;
    unitRate: string | number;
    projectId?: string | null;
    itemCategory?: string;
}

export class ProjectBOQService {
    /**
     * Get list of BOQ items for a project
     */
    static async getBOQItems(projectId: string) {
        const boqItems = await prisma.projectBOQItem.findMany({
            where: { projectId },
            include: {
                material: {
                    select: {
                        id: true,
                        code: true,
                        name: true,
                        unit: true
                    }
                }
            },
            orderBy: { itemCode: 'asc' }
        });
        return boqItems;
    }

    /**
     * Create a BOQ item
     */
    static async createBOQItem(data: CreateBOQItemInput) {
        const {
            projectId,
            itemCode,
            description,
            unit,
            quantity,
            unitRate,
            category,
            materialId,
            remarks
        } = data;

        const quantityVal = parseFloat(String(quantity));
        const unitRateVal = parseFloat(String(unitRate));
        const amount = quantityVal * unitRateVal;

        const boqItem = await prisma.projectBOQItem.create({
            data: {
                projectId,
                itemCode,
                description,
                unit,
                quantity: quantityVal,
                unitRate: unitRateVal,
                amount,
                category: category || null,
                materialId: materialId || null,
                remarks: remarks || null
            },
            include: {
                material: true
            }
        });

        return boqItem;
    }

    /**
     * Update a BOQ item
     */
    static async updateBOQItem(id: string, updateData: UpdateBOQItemInput) {
        const data: Record<string, unknown> = {};

        if (updateData.category !== undefined) data.category = updateData.category;
        if (updateData.materialId !== undefined) data.materialId = updateData.materialId;
        if (updateData.remarks !== undefined) data.remarks = updateData.remarks;
        if (updateData.description !== undefined) data.description = updateData.description;
        if (updateData.unit !== undefined) data.unit = updateData.unit;

        if (updateData.quantity !== undefined) {
            const quantityVal = parseFloat(String(updateData.quantity));
            data.quantity = quantityVal;
            if (updateData.unitRate !== undefined) {
                const rateVal = parseFloat(String(updateData.unitRate));
                data.unitRate = rateVal;
                data.amount = quantityVal * rateVal;
            }
        } else if (updateData.unitRate !== undefined) {
            // Recalculate using existing quantity
            const existing = await prisma.projectBOQItem.findUnique({ where: { id } });
            if (existing) {
                const rateVal = parseFloat(String(updateData.unitRate));
                data.unitRate = rateVal;
                data.amount = (existing.quantity || 0) * rateVal;
            }
        }

        if (updateData.actualQuantity !== undefined) {
            data.actualQuantity = parseFloat(String(updateData.actualQuantity));
        }
        if (updateData.actualCost !== undefined) {
            data.actualCost = parseFloat(String(updateData.actualCost));
        }

        const boqItem = await prisma.projectBOQItem.update({
            where: { id },
            data,
            include: {
                material: true
            }
        });

        return boqItem;
    }

    /**
     * Delete a BOQ item
     */
    static async deleteBOQItem(id: string) {
        await prisma.projectBOQItem.delete({
            where: { id }
        });
        return { success: true };
    }

    /**
     * Get all BOQ rate configs
     */
    static async getBOQRates(projectId?: string | null, isActive?: boolean | null) {
        const where: Record<string, unknown> = {};
        if (projectId) {
            where.OR = [{ projectId }, { projectId: null }];
        }
        if (isActive !== null && isActive !== undefined) {
            where.isActive = isActive;
        }

        const rates = await prisma.bOQRateConfig.findMany({
            where,
            orderBy: [{ projectId: { sort: 'asc', nulls: 'first' } }, { itemCode: 'asc' }],
        });

        return rates;
    }

    /**
     * Create or update a BOQ rate config
     */
    static async saveBOQRate(data: SaveBOQRateInput) {
        const { itemCode, description, unit, unitRate, itemCategory, projectId, isActive } = data;
        const rateVal = parseFloat(String(unitRate));
        const projId = projectId || null;

        const existing = await prisma.bOQRateConfig.findFirst({
            where: {
                itemCode,
                projectId: projId,
            },
        });

        let rate;
        if (existing) {
            rate = await prisma.bOQRateConfig.update({
                where: { id: existing.id },
                data: {
                    description: description ?? existing.description,
                    unit: unit ?? existing.unit,
                    unitRate: rateVal,
                    itemCategory: itemCategory ?? existing.itemCategory,
                    isActive: isActive !== undefined ? isActive : existing.isActive,
                },
            });
        } else {
            rate = await prisma.bOQRateConfig.create({
                data: {
                    itemCode,
                    description: description || itemCode,
                    unit: unit || 'UNIT',
                    unitRate: rateVal,
                    itemCategory: itemCategory || 'MATERIAL',
                    projectId: projId,
                    isActive: isActive !== undefined ? isActive : true,
                },
            });
        }

        return { rate, isNew: !existing };
    }

    /**
     * Bulk update BOQ rates
     */
    static async bulkUpdateBOQRates(rates: BulkRateInput[]) {
        const results = await Promise.allSettled(
            rates.map(async (r) => {
                if (!r.itemCode || r.unitRate === undefined) {
                    throw AppError.badRequest(`Missing itemCode or unitRate for entry`);
                }

                const existing = await prisma.bOQRateConfig.findFirst({
                    where: { itemCode: r.itemCode, projectId: r.projectId || null },
                });

                const rateVal = parseFloat(String(r.unitRate));

                if (existing) {
                    return prisma.bOQRateConfig.update({
                        where: { id: existing.id },
                        data: { 
                            unitRate: rateVal,
                            ...(r.itemCategory ? { itemCategory: r.itemCategory } : {})
                        },
                    });
                }

                return prisma.bOQRateConfig.create({
                    data: {
                        itemCode: r.itemCode,
                        unitRate: rateVal,
                        projectId: r.projectId || null,
                        itemCategory: r.itemCategory || 'MATERIAL',
                    },
                });
            })
        );

        const succeeded = results.filter((r) => r.status === 'fulfilled').length;
        const failed = results.filter((r) => r.status === 'rejected').length;

        return {
            succeeded,
            failed,
            total: rates.length
        };
    }

    /**
     * Analyze BOQ items against inventory stock
     */
    static async analyzeBOQ(projectId: string) {
        const project = await prisma.project.findUnique({
            where: { id: projectId },
            include: { opmc: true }
        });

        if (!project) throw AppError.badRequest('PROJECT_NOT_FOUND');

        const boqItems = await prisma.projectBOQItem.findMany({
            where: {
                projectId,
                category: { in: ['MATERIAL', 'CABLE', 'CIVIL'] }
            },
            include: { material: true }
        });

        let store = null;
        if (project.opmcId) {
            store = await prisma.inventoryStore.findFirst({
                where: { opmcs: { some: { id: project.opmcId } } }
            });
        }

        if (!store) {
            store = await prisma.inventoryStore.findFirst({
                where: { type: 'MAIN' }
            });
        }

        if (!store) {
            throw AppError.badRequest('NO_STORE_FOUND');
        }

        const materialIds = boqItems.map(i => i.materialId).filter((id): id is string => id !== null);
        const itemCodes = boqItems.filter(i => !i.materialId).map(i => i.itemCode);

        const stocks = await prisma.inventoryStock.findMany({
            where: {
                storeId: store.id,
                item: {
                    OR: [
                        { id: { in: materialIds } },
                        { code: { in: itemCodes } }
                    ]
                }
            },
            include: { item: true }
        });

        const analysis = boqItems.map(boqItem => {
            const stock = stocks.find(s =>
                s.itemId === boqItem.materialId ||
                s.item.code === boqItem.itemCode
            );

            const stockQty = stock ? Number(stock.quantity) : 0;
            const requiredQty = Number(boqItem.quantity);
            const shortfall = Math.max(0, requiredQty - stockQty);
            const recommendedSource = shortfall > 0 ? 'NEW' : 'EXISTING';

            return {
                boqItemId: boqItem.id,
                itemCode: boqItem.itemCode,
                description: boqItem.description,
                unit: boqItem.unit,
                requiredQty,
                availableStock: stockQty,
                shortfall,
                currentSource: boqItem.source,
                recommendedSource,
                materialId: stock?.item?.id || boqItem.materialId
            };
        });

        return {
            store: { id: store.id, name: store.name, type: store.type },
            analysis
        };
    }

    /**
     * Bulk update BOQ sources
     */
    static async updateBOQSources(updates: { boqItemId: string; source: string; materialId?: string | null }[]) {
        const updatePromises = updates.map(update =>
            prisma.projectBOQItem.update({
                where: { id: update.boqItemId },
                data: {
                    source: update.source,
                    materialId: update.materialId || undefined
                }
            })
        );

        await Promise.all(updatePromises);
        return { success: true };
    }
}
