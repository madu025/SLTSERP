import { prisma } from '@/lib/prisma';
import { OfficeAssetCategory, Prisma } from '@prisma/client';

export interface CreateOfficeAssetDTO {
  assetNumber: string;
  serialNumber?: string;
  name: string;
  category: OfficeAssetCategory;
  siteOfficeId?: string;
  locationDetails?: string;
  brand?: string;
  model?: string;
  purchaseCost?: number;
  purchaseDate?: Date;
  warrantyExpiry?: Date;
  metadata?: Record<string, unknown>;
}

export interface MoveOfficeAssetDTO {
  assetId: string;
  toSiteId?: string;
  toStaffId?: string;
  locationDetails?: string;
  action: string;
  remarks?: string;
  performedById: string;
}

export class OfficeAssetService {
  /**
   * Fetch all office assets with basic relations
   */
  static async getAllAssets() {
    return prisma.officeAsset.findMany({
      include: {
        siteOffice: {
          select: { id: true, name: true }
        },
        assignedStaff: {
          select: { id: true, name: true, employeeId: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  /**
   * Get specific asset with full history
   */
  static async getAssetById(id: string) {
    const asset = await prisma.officeAsset.findUnique({
      where: { id },
      include: {
        siteOffice: true,
        assignedStaff: true,
        fixedAsset: true,
        movementLogs: {
          include: {
            fromSite: { select: { name: true } },
            toSite: { select: { name: true } },
            fromStaff: { select: { name: true } },
            toStaff: { select: { name: true } },
            performedBy: { select: { name: true } }
          },
          orderBy: { createdAt: 'desc' }
        },
        maintenanceLogs: {
          orderBy: { serviceDate: 'desc' },
          include: {
            performedBy: { select: { name: true } }
          }
        }
      }
    });

    if (!asset) {
      throw new Error(`Office Asset with ID ${id} not found.`);
    }
    return asset;
  }

  /**
   * Create a new EAM Office Asset
   */
  static async createAsset(data: CreateOfficeAssetDTO, createdById: string) {
    return prisma.$transaction(async (tx) => {
      const newAsset = await tx.officeAsset.create({
        data: {
          assetNumber: data.assetNumber,
          serialNumber: data.serialNumber,
          name: data.name,
          category: data.category,
          siteOfficeId: data.siteOfficeId,
          locationDetails: data.locationDetails,
          brand: data.brand,
          model: data.model,
          purchaseCost: data.purchaseCost,
          purchaseDate: data.purchaseDate,
          warrantyExpiry: data.warrantyExpiry,
          metadata: data.metadata ? (data.metadata as Prisma.InputJsonValue) : undefined,
          status: 'ACTIVE',
        }
      });

      // Log initial creation movement if there's a site
      if (data.siteOfficeId) {
        await tx.officeAssetMovementLog.create({
          data: {
            assetId: newAsset.id,
            toSiteId: data.siteOfficeId,
            action: 'INITIAL_REGISTRATION',
            remarks: 'Asset registered in system',
            performedById: createdById,
          }
        });
      }

      return newAsset;
    });
  }

  /**
   * Move an asset to a new location or staff
   */
  static async moveAsset(data: MoveOfficeAssetDTO) {
    return prisma.$transaction(async (tx) => {
      const asset = await tx.officeAsset.findUnique({ where: { id: data.assetId } });
      if (!asset) throw new Error('Asset not found');

      // Update the asset
      const updatedAsset = await tx.officeAsset.update({
        where: { id: data.assetId },
        data: {
          siteOfficeId: data.toSiteId ?? asset.siteOfficeId,
          assignedStaffId: data.toStaffId ?? null, // Overwrite staff
          locationDetails: data.locationDetails ?? asset.locationDetails,
        }
      });

      // Create Movement Log
      await tx.officeAssetMovementLog.create({
        data: {
          assetId: data.assetId,
          fromSiteId: asset.siteOfficeId,
          toSiteId: data.toSiteId,
          fromStaffId: asset.assignedStaffId,
          toStaffId: data.toStaffId,
          action: data.action,
          remarks: data.remarks,
          performedById: data.performedById
        }
      });

      return updatedAsset;
    });
  }
}
