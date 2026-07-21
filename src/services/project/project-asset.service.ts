import { prisma } from '@/lib/prisma';
import { AppError } from '@/lib/error';

interface CreateAssetInput {
    assetType: string;
    assetCode?: string;
    assetName: string;
    description?: string;
    address?: string;
    latitude?: number;
    longitude?: number;
    status?: string;
    createdById?: string;
}

export class ProjectAssetService {
    static async getAssets(projectId: string) {
        return await prisma.projectAsset.findMany({
            where: { projectId },
            include: {
                cables: true,
                connections: true,
                documents: true
            },
            orderBy: { createdAt: 'desc' }
        });
    }

    static async createAsset(projectId: string, data: CreateAssetInput) {
        const { assetType, assetCode, assetName, description, address, latitude, longitude, status, createdById } = data;

        return await prisma.projectAsset.create({
            data: {
                projectId,
                assetType,
                assetCode: assetCode || null,
                assetName,
                description: description || null,
                address: address || null,
                latitude: latitude || null,
                longitude: longitude || null,
                status: status || 'ACTIVE',
                createdById: createdById || 'system'
            },
            include: {
                cables: true,
                connections: true
            }
        });
    }
}
