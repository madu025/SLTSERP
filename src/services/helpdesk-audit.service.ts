import { prisma } from "@/lib/prisma";
import { HelpdeskService } from "./helpdesk.service";
import { ITDeviceType, ITAssetStatus } from "@prisma/client";

export class HelpdeskAuditService {
  static async submitAudit(data: {
    serialNumber: string;
    assetNumber?: string | null;
    deviceType: ITDeviceType;
    brand: string;
    model: string;
    employeeNo: string;
    custodianName: string;
    status: ITAssetStatus;
    remarks?: string | null;
    isConfirmed?: boolean;
    department?: string | null;
    siteOfficeId?: string | null;
    location?: string | null;
  }) {
    const serial = data.serialNumber.trim();
    const empNo = data.employeeNo.trim();
    const custName = data.custodianName.trim();
    const dept = data.department?.trim() || null;
    const siteId = data.siteOfficeId?.trim() || null;
    const loc = data.location?.trim() || null;

    // Check if the device exists in active inventory
    const existingAsset = await prisma.iTAsset.findFirst({
      where: {
        serialNumber: {
          equals: serial,
          mode: 'insensitive'
        }
      },
      include: {
        assignedStaff: true
      }
    });

    let isMatched = false;
    if (existingAsset) {
      const brandMatch = existingAsset.brand.toLowerCase().trim() === data.brand.toLowerCase().trim();
      const modelMatch = existingAsset.model.toLowerCase().trim() === data.model.toLowerCase().trim();
      const staffMatch = existingAsset.assignedStaff?.employeeId?.toLowerCase().trim() === empNo.toLowerCase();
      const deptMatch = (existingAsset.department || "").toLowerCase().trim() === (dept || "").toLowerCase().trim();
      const siteMatch = (existingAsset.siteOfficeId || "") === (siteId || "");
      const locMatch = (existingAsset.location || "").toLowerCase().trim() === (loc || "").toLowerCase().trim();
      isMatched = brandMatch && modelMatch && staffMatch && deptMatch && siteMatch && locMatch;
    }

    // Save submission
    const auditRecord = await prisma.iTAssetAudit.create({
      data: {
        serialNumber: serial,
        assetNumber: data.assetNumber?.trim() || null,
        deviceType: data.deviceType,
        brand: data.brand.trim(),
        model: data.model.trim(),
        employeeNo: empNo,
        custodianName: custName,
        department: dept,
        siteOfficeId: siteId,
        location: loc,
        status: data.status,
        remarks: data.remarks || null,
        isConfirmed: data.isConfirmed ?? false,
        isMatched,
        isRejected: false
      }
    });

    return auditRecord;
  }

  static async getAudits() {
    const audits = await prisma.iTAssetAudit.findMany({
      where: {
        isRejected: false
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    const serials = audits.map(a => a.serialNumber);
    const existingAssets = await prisma.iTAsset.findMany({
      where: {
        serialNumber: {
          in: serials,
          mode: 'insensitive'
        }
      },
      include: {
        assignedStaff: {
          select: {
            id: true,
            employeeId: true,
            name: true
          }
        },
        siteOffice: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    return audits.map(audit => {
      const asset = existingAssets.find(ea => ea.serialNumber.toLowerCase() === audit.serialNumber.toLowerCase());
      return {
        ...audit,
        existingAsset: asset ? {
          id: asset.id,
          assetNumber: asset.assetNumber,
          brand: asset.brand,
          model: asset.model,
          deviceType: asset.deviceType,
          status: asset.status,
          department: asset.department,
          siteOfficeId: asset.siteOfficeId,
          siteOfficeName: asset.siteOffice?.name || null,
          location: asset.location,
          assignedStaff: asset.assignedStaff ? {
            id: asset.assignedStaff.id,
            employeeId: asset.assignedStaff.employeeId,
            name: asset.assignedStaff.name
          } : null
        } : null
      };
    });
  }

  static async rejectAudit(auditId: string) {
    return prisma.iTAssetAudit.update({
      where: { id: auditId },
      data: { isRejected: true }
    });
  }

  static async syncAuditToInventory(auditId: string, updatedData?: {
    brand?: string;
    model?: string;
    deviceType?: ITDeviceType;
    assetNumber?: string | null;
    department?: string | null;
    siteOfficeId?: string | null;
    location?: string | null;
    status?: ITAssetStatus;
  }) {
    const audit = await prisma.iTAssetAudit.findUnique({
      where: { id: auditId }
    });

    if (!audit) {
      throw new Error("Audit record not found");
    }

    if (audit.isSynced) {
      throw new Error("Audit record is already synchronized");
    }

    // Merge submitted details with optional admin updates
    const brand = updatedData?.brand?.trim() || audit.brand;
    const model = updatedData?.model?.trim() || audit.model;
    const deviceType = updatedData?.deviceType || audit.deviceType;
    const assetNumber = updatedData?.assetNumber !== undefined ? (updatedData.assetNumber?.trim() || null) : audit.assetNumber;
    const department = updatedData?.department !== undefined ? updatedData.department : audit.department;
    const siteOfficeId = updatedData?.siteOfficeId !== undefined ? updatedData.siteOfficeId : audit.siteOfficeId;
    const location = updatedData?.location !== undefined ? updatedData.location : audit.location;
    const status = updatedData?.status || audit.status;

    return prisma.$transaction(async (tx) => {
      // 1. Find or create staff member
      let staff = await tx.staff.findFirst({
        where: {
          employeeId: {
            equals: audit.employeeNo,
            mode: 'insensitive'
          }
        }
      });

      if (!staff) {
        staff = await tx.staff.create({
          data: {
            employeeId: audit.employeeNo.toUpperCase(),
            name: audit.custodianName,
            designation: "ENGINEER"
          }
        });
      }

      // Provision user account for staff member if not exists
      await HelpdeskService.ensureUserAccountForStaff(staff.id, tx as any);

      // 2. Find or create ITAsset
      const existingAsset = await tx.iTAsset.findFirst({
        where: {
          serialNumber: {
            equals: audit.serialNumber,
            mode: 'insensitive'
          }
        }
      });

      if (existingAsset) {
        // Update existing asset details and custodian
        await tx.iTAsset.update({
          where: { id: existingAsset.id },
          data: {
            assetNumber: assetNumber || existingAsset.assetNumber,
            brand,
            model,
            deviceType,
            status,
            department,
            siteOfficeId,
            location,
            assignedStaffId: staff.id
          }
        });
      } else {
        // Generate a valid asset number if none provided
        let targetAssetNo = assetNumber?.trim();
        if (!targetAssetNo) {
          const count = await tx.iTAsset.count();
          targetAssetNo = `SLT-AUDIT-${1000 + count + 1}`;
        }

        // Create new asset
        await tx.iTAsset.create({
          data: {
            assetNumber: targetAssetNo,
            serialNumber: audit.serialNumber,
            brand,
            model,
            deviceType,
            status,
            department,
            siteOfficeId,
            location,
            assignedStaffId: staff.id
          }
        });
      }

      // 3. Mark audit as synced and matched
      const updatedAudit = await tx.iTAssetAudit.update({
        where: { id: auditId },
        data: {
          isSynced: true,
          isMatched: true,
          brand,
          model,
          deviceType,
          assetNumber,
          department,
          siteOfficeId,
          location,
          status
        }
      });

      return updatedAudit;
    });
  }
}
