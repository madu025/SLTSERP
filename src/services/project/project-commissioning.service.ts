import { prisma } from '@/lib/prisma';
import { AppError } from '@/lib/error';

interface CommissionAssetInput {
    name: string;
    serialNumber: string;
    warrantyMonths?: number;
    status?: string;
    assetType?: string;
    latitude?: number | null;
    longitude?: number | null;
    createdById?: string;
}

export class ProjectCommissioningService {
    static async getCommissionedAssets(projectId: string) {
        const assets = await prisma.projectAsset.findMany({
            where: { projectId },
            include: {
                _count: {
                    select: { documents: true }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        return assets.map((asset) => ({
            id: asset.id,
            name: asset.assetName,
            serialNumber: asset.assetCode,
            status: asset.status,
            type: asset.assetType,
            warrantyMonths: 12,
            date: asset.installationDate || asset.createdAt.toISOString(),
            location: asset.latitude ? `${asset.latitude}, ${asset.longitude}` : null,
            inspections: asset._count.documents
        }));
    }

    static async commissionAsset(projectId: string, data: CommissionAssetInput) {
        const asset = await prisma.projectAsset.create({
            data: {
                projectId,
                assetType: data.assetType || 'COMMISSIONED_EQUIPMENT',
                assetCode: data.serialNumber,
                assetName: data.name,
                status: data.status || 'COMMISSIONED',
                latitude: data.latitude || null,
                longitude: data.longitude || null,
                sourceType: 'MANUAL',
                createdById: data.createdById || 'system',
                installationDate: new Date().toISOString()
            }
        });

        return {
            success: true,
            asset: {
                id: asset.id,
                name: asset.assetName,
                serialNumber: asset.assetCode,
                status: asset.status,
                type: asset.assetType,
                warrantyMonths: 12,
                date: asset.installationDate,
                location: asset.latitude ? `${asset.latitude}, ${asset.longitude}` : null,
            }
        };
    }
}