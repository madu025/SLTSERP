import { prisma } from "@/lib/prisma";
import { HelpdeskService } from "./helpdesk.service";
import { ITDeviceType, ITAssetStatus } from "@prisma/client";

export class HelpdeskAuditService {
  /**
   * Submits a new IT Asset Audit.
   * @timeComplexity O(1) amortized, assuming DB indices on serialNumber
   * @spaceComplexity O(1) constant memory for the payload
   */
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
    isPersonal?: boolean;
    department?: string | null;
    siteOfficeId?: string | null;
    location?: string | null;
  }) {
    const isPers = data.isPersonal ?? false;
    const empNo = data.employeeNo.trim().toUpperCase();
    const serial = isPers ? `PERSONAL-${data.deviceType}-${empNo}` : data.serialNumber.trim().toUpperCase();
    const brand = isPers ? "Personal" : data.brand.trim();
    const model = isPers ? "Personal Device" : data.model.trim();
    
    const custName = data.custodianName.trim();
    const dept = data.department?.trim() || null;
    const siteId = data.siteOfficeId?.trim() || null;
    const loc = data.location?.trim() || null;

    let isMatched = false;
    
    if (!isPers) {
      // Check if the device exists in active inventory
      const existingAsset = await prisma.iTAsset.findFirst({
        where: {
          serialNumber: serial
        },
        include: {
          assignedStaff: true
        }
      });

      if (existingAsset) {
        const brandMatch = existingAsset.brand.toLowerCase().trim() === brand.toLowerCase().trim();
        const modelMatch = existingAsset.model.toLowerCase().trim() === model.toLowerCase().trim();
        const staffMatch = existingAsset.assignedStaff?.employeeId?.toLowerCase().trim() === empNo.toLowerCase();
        const deptMatch = (existingAsset.department || "").toLowerCase().trim() === (dept || "").toLowerCase().trim();
        const siteMatch = (existingAsset.siteOfficeId || "") === (siteId || "");
        const locMatch = (existingAsset.location || "").toLowerCase().trim() === (loc || "").toLowerCase().trim();
        isMatched = brandMatch && modelMatch && staffMatch && deptMatch && siteMatch && locMatch;
      }
    }

    // Save submission
    const auditRecord = await prisma.iTAssetAudit.create({
      data: {
        serialNumber: serial,
        assetNumber: isPers ? null : (data.assetNumber?.trim().toUpperCase() || null),
        deviceType: data.deviceType,
        brand: brand,
        model: model,
        employeeNo: empNo,
        custodianName: custName,
        department: dept,
        siteOfficeId: siteId,
        location: loc,
        status: data.status,
        remarks: data.remarks || null,
        isConfirmed: data.isConfirmed ?? false,
        isPersonal: isPers,
        isMatched,
        isRejected: false
      }
    });

    return auditRecord;
  }

  /**
   * Fetch all audits and map to corresponding IT Assets.
   * @timeComplexity O(N + M) where N = number of audits, M = number of matching assets
   * @spaceComplexity O(N + M) to store maps and returned objects
   */
  static async getAudits() {
    const audits = await prisma.iTAssetAudit.findMany({
      where: {
        isRejected: false
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    const serials = audits.map(a => a.serialNumber.toUpperCase());
    const existingAssets = await prisma.iTAsset.findMany({
      where: {
        serialNumber: {
          in: serials
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

    // O(M) time & space: create lookup map for faster matching
    const assetMap = new Map<string, typeof existingAssets[0]>();
    for (const asset of existingAssets) {
      assetMap.set(asset.serialNumber.toLowerCase().trim(), asset);
    }

    // O(N) time & space
    return audits.map(audit => {
      const asset = assetMap.get(audit.serialNumber.toLowerCase().trim());
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
          } : null,
          imei2: asset.imei2,
          simNumber: asset.simNumber,
          mdmEnrolled: asset.mdmEnrolled
        } : null
      };
    });
  }

  /**
   * Rejects an audit by ID.
   * @timeComplexity O(1) DB update by primary key
   * @spaceComplexity O(1)
   */
  static async rejectAudit(auditId: string) {
    return prisma.iTAssetAudit.update({
      where: { id: auditId },
      data: { isRejected: true }
    });
  }

  /**
   * Deletes an audit by ID.
   * @timeComplexity O(1) DB delete by primary key
   * @spaceComplexity O(1)
   */
  static async deleteAudit(auditId: string) {
    return prisma.iTAssetAudit.delete({
      where: { id: auditId }
    });
  }

  /**
   * Synchronizes an audit to the live inventory and performs necessary auto-provisioning.
   * @timeComplexity O(1) time per record, assuming DB lookups use indexed fields (serialNumber, assetNumber)
   * @spaceComplexity O(1) constant overhead for merging objects and making DB calls
   */
  static async syncAuditToInventory(auditId: string, updatedData?: {
    brand?: string;
    model?: string;
    deviceType?: ITDeviceType;
    assetNumber?: string | null;
    department?: string | null;
    siteOfficeId?: string | null;
    location?: string | null;
    status?: ITAssetStatus;
    imei2?: string | null;
    simNumber?: string | null;
    mdmEnrolled?: boolean | null;
  }, adminUserId?: string | null) {
    const audit = await prisma.iTAssetAudit.findUnique({
      where: { id: auditId }
    });

    if (!audit) {
      throw new Error("Audit record not found");
    }

    if (audit.isSynced) {
      throw new Error("Audit record is already synchronized");
    }

    // Merge submitted details with optional admin updates & sanitize empty strings to null
    const brand = updatedData?.brand?.trim() || audit.brand;
    const model = updatedData?.model?.trim() || audit.model;
    const deviceType = updatedData?.deviceType || audit.deviceType;
    const assetNumber = updatedData?.assetNumber !== undefined ? (updatedData.assetNumber?.trim().toUpperCase() || null) : audit.assetNumber;
    const department = updatedData?.department !== undefined ? (updatedData.department?.trim() || null) : audit.department;
    const siteOfficeId = updatedData?.siteOfficeId !== undefined ? (updatedData.siteOfficeId?.trim() || null) : audit.siteOfficeId;
    const location = updatedData?.location !== undefined ? (updatedData.location?.trim() || null) : audit.location;
    const status = updatedData?.status || audit.status;
    const imei2 = updatedData?.imei2 !== undefined ? (updatedData.imei2?.trim() || null) : null;
    const simNumber = updatedData?.simNumber !== undefined ? (updatedData.simNumber?.trim() || null) : null;
    const mdmEnrolled = updatedData?.mdmEnrolled !== undefined ? !!updatedData.mdmEnrolled : false;

    return prisma.$transaction(async (tx) => {
      // 1. Find or create staff member
      let staff = await tx.staff.findFirst({
        where: {
          employeeId: audit.employeeNo.toUpperCase()
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
      await HelpdeskService.ensureUserAccountForStaff(staff.id, tx as Parameters<typeof HelpdeskService.ensureUserAccountForStaff>[1]);

      // Fetch linked user account
      const user = await tx.user.findFirst({
        where: { staffId: staff.id },
        select: { id: true }
      });

      if (audit.isPersonal) {
        // Skip ITAsset inventory syncing for personal devices
        const updatedAudit = await tx.iTAssetAudit.update({
          where: { id: auditId },
          data: {
            isSynced: true,
            isMatched: true
          }
        });
        return updatedAudit;
      }

      // 2. Validate Duplicate Asset Number
      if (assetNumber) {
        const duplicateAsset = await tx.iTAsset.findFirst({
          where: {
            assetNumber: assetNumber,
            serialNumber: {
              not: audit.serialNumber
            }
          }
        });
        if (duplicateAsset) {
          throw new Error(`Asset Number "${assetNumber}" is already assigned to a device with Serial Number: "${duplicateAsset.serialNumber}"`);
        }
      }

      // 3. Find or create ITAsset
      const existingAsset = await tx.iTAsset.findFirst({
        where: {
          serialNumber: audit.serialNumber.toUpperCase()
        }
      });

      let targetAssetId = "";

      if (existingAsset) {
        // Update existing asset details and custodian
        const updated = await tx.iTAsset.update({
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
            assignedStaffId: staff.id,
            assignedUserId: user?.id || null,
            imei2,
            simNumber,
            mdmEnrolled
          }
        });
        targetAssetId = updated.id;

        // Log the handover update inside logs
        await tx.assetHandoverLog.create({
          data: {
            assetId: targetAssetId,
            transactionType: 'ISSUED_TO_USER',
            performedById: adminUserId || 'SYSTEM',
            targetStaffId: staff.id,
            condition: 'Good',
            remarks: `Audit Reconciled & Synced (Custodian verified/updated)`
          }
        });
      } else {
        // Generate a type-specific asset number if none provided
        let targetAssetNo = assetNumber?.trim();
        if (!targetAssetNo) {
          const typePrefix = deviceType === "LAPTOP" ? "LAP" : deviceType === "MOBILE" ? "MOB" : "AST";
          const count = await tx.iTAsset.count({
            where: { deviceType }
          });
          targetAssetNo = `SLT-${typePrefix}-${1000 + count + 1}`;
        }

        // Create new asset
        const created = await tx.iTAsset.create({
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
            assignedStaffId: staff.id,
            assignedUserId: user?.id || null,
            imei2,
            simNumber,
            mdmEnrolled
          }
        });
        targetAssetId = created.id;

        // Create handover log
        await tx.assetHandoverLog.create({
          data: {
            assetId: targetAssetId,
            transactionType: 'ISSUED_TO_USER',
            performedById: adminUserId || 'SYSTEM',
            targetStaffId: staff.id,
            condition: 'Good',
            remarks: `Audit Reconciled & Synced (New Asset registration)`
          }
        });
      }

      // 4. Mark audit as synced and matched
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

  /**
   * Identifies gaps between physical audits and system inventory.
   * @timeComplexity O(N + M) where N is number of audits and M is number of assets
   * @spaceComplexity O(N + M) to store maps and result arrays
   */
  static async getAuditGaps() {
    // Fetch all active audits that are not personal devices and not rejected
    const audits = await prisma.iTAssetAudit.findMany({
      where: {
        isRejected: false,
        isPersonal: false
      }
    });

    // Fetch all assets to properly identify unregistered and mismatched devices
    const allAssets = await prisma.iTAsset.findMany({
      include: {
        assignedStaff: true,
        siteOffice: true
      }
    });

    // O(N) time & space
    const auditSerials = new Set(audits.map(a => a.serialNumber.toLowerCase().trim()));
    
    // O(M) time & space
    const assetMap = new Map<string, typeof allAssets[0]>();
    for (const asset of allAssets) {
      assetMap.set(asset.serialNumber.toLowerCase().trim(), asset);
    }

    // 1. Missing Audits: Assets that have an assigned staff, but no audit was submitted
    // O(M) time filtering
    const missingAudits = allAssets
      .filter(asset => asset.assignedStaffId !== null && !auditSerials.has(asset.serialNumber.toLowerCase().trim()))
      .map(asset => ({
        assetId: asset.id,
        assetNumber: asset.assetNumber,
        serialNumber: asset.serialNumber,
        brand: asset.brand,
        model: asset.model,
        deviceType: asset.deviceType,
        assignedStaffName: asset.assignedStaff?.name || 'Unknown',
        assignedStaffId: asset.assignedStaff?.employeeId || 'Unknown',
        department: asset.department,
        siteOffice: asset.siteOffice?.name,
        location: asset.location
      }));
    
    // 2. Unregistered Devices: Audits submitted for serial numbers that do not exist in the DB AT ALL
    // O(N) time filtering
    const unregisteredDevices = audits
      .filter(audit => !assetMap.has(audit.serialNumber.toLowerCase().trim()))
      .map(audit => ({
        auditId: audit.id,
        serialNumber: audit.serialNumber,
        brand: audit.brand,
        model: audit.model,
        deviceType: audit.deviceType,
        custodianName: audit.custodianName,
        employeeNo: audit.employeeNo,
        department: audit.department,
        location: audit.location
      }));

    // 3. Mismatched Data: Audits that matched an existing asset, but the details didn't match perfectly
    // O(N) time filtering (O(1) lookups via assetMap)
    const mismatchedData = audits
      .filter(audit => assetMap.has(audit.serialNumber.toLowerCase().trim()) && audit.isMatched === false)
      .map(audit => {
        const matchedAsset = assetMap.get(audit.serialNumber.toLowerCase().trim());
        
        return {
          auditId: audit.id,
          serialNumber: audit.serialNumber,
          auditDetails: {
            brand: audit.brand,
            model: audit.model,
            custodianName: audit.custodianName,
            employeeNo: audit.employeeNo,
            department: audit.department,
            location: audit.location
          },
          systemDetails: matchedAsset ? {
            brand: matchedAsset.brand,
            model: matchedAsset.model,
            custodianName: matchedAsset.assignedStaff?.name || null,
            employeeNo: matchedAsset.assignedStaff?.employeeId || null,
            department: matchedAsset.department,
            location: matchedAsset.location
          } : null
        };
      });

    return {
      missingAudits,
      unregisteredDevices,
      mismatchedData,
      summary: {
        totalMissing: missingAudits.length,
        totalUnregistered: unregisteredDevices.length,
        totalMismatched: mismatchedData.length
      }
    };
  }
}
