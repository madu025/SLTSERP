import { prisma } from '@/lib/prisma';
import { AppError } from '@/lib/error';

export interface CreateLocatorInput {
    storeId: string;
    code: string;
    aisle?: string;
    rack?: string;
    shelf?: string;
    bin?: string;
    description?: string;
}

export class LocatorService {
    static async getLocatorsByStore(storeId: string) {
        return await prisma.warehouseLocator.findMany({
            where: { storeId, isActive: true },
            orderBy: { code: 'asc' }
        });
    }

    static async createLocator(data: CreateLocatorInput) {
        const existing = await prisma.warehouseLocator.findUnique({
            where: {
                storeId_code: {
                    storeId: data.storeId,
                    code: data.code
                }
            }
        });

        if (existing) {
            throw AppError.badRequest(`Locator code "${data.code}" already exists in this store.`);
        }

        return await prisma.warehouseLocator.create({
            data: {
                storeId: data.storeId,
                code: data.code.toUpperCase(),
                aisle: data.aisle,
                rack: data.rack,
                shelf: data.shelf,
                bin: data.bin,
                description: data.description
            }
        });
    }

    static async deleteLocator(locatorId: string) {
        const locator = await prisma.warehouseLocator.findUnique({
            where: { id: locatorId }
        });

        if (!locator) {
            throw AppError.notFound("Warehouse locator not found");
        }

        return await prisma.warehouseLocator.update({
            where: { id: locatorId },
            data: { isActive: false }
        });
    }
}
