import { AppError } from '@/lib/error';
import { prisma } from '@/lib/prisma';
import { Role } from '@prisma/client';

export interface CreateStaffInput {
  name: string;
  employeeId: string;
  designation: Role;
  reportsToId?: string | null;
  opmcId?: string | null;
  userId?: string | null;
}

export interface UpdateStaffInput {
  name?: string;
  designation?: Role;
  reportsToId?: string | null;
  opmcId?: string | null;
  userId?: string | null;
}

export class StaffService {
  /**
   * Get all staff with hierarchy info and linked users
   */
  static async getStaff() {
    return prisma.staff.findMany({
      select: {
        id: true,
        name: true,
        employeeId: true,
        designation: true,
        reportsToId: true,
        opmcId: true,
        opmc: { select: { rtom: true, name: true } },
        user: {
          select: {
            id: true,
            username: true,
            name: true,
            role: true
          }
        }
      },
      orderBy: { name: 'asc' }
    });
  }

  /**
   * Create new staff member
   */
  static async createStaff(data: CreateStaffInput) {
    const { name, employeeId, designation, reportsToId, opmcId, userId } = data;

    const staff = await prisma.staff.create({
      data: {
        name,
        employeeId,
        designation,
        reportsToId: reportsToId || null,
        opmcId: opmcId || null
      }
    });

    if (userId) {
      await prisma.user.update({
        where: { id: userId },
        data: { staffId: staff.id }
      });
    }

    return staff;
  }

  /**
   * Update staff details, hierarchy, or user assignment
   */
  static async updateStaff(id: string, data: UpdateStaffInput) {
    const { name, designation, reportsToId, opmcId, userId } = data;

    if (id === reportsToId) {
      throw AppError.badRequest('CANNOT_REPORT_TO_SELF');
    }

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (designation !== undefined) updateData.designation = designation;
    if (reportsToId !== undefined) updateData.reportsToId = reportsToId;
    if (opmcId !== undefined) updateData.opmcId = opmcId;

    const updatedStaff = await prisma.staff.update({
      where: { id },
      data: updateData
    });

    if (userId !== undefined) {
      if (userId === null) {
        await prisma.user.updateMany({
          where: { staffId: id },
          data: { staffId: null }
        });
      } else {
        await prisma.user.update({
          where: { id: userId },
          data: { staffId: id }
        });
      }
    }

    return updatedStaff;
  }

  /**
   * Delete staff member after checking validations
   */
  static async deleteStaff(id: string) {
    // 1. Check subordinates
    const subordinates = await prisma.staff.count({
      where: { reportsToId: id }
    });

    if (subordinates > 0) {
      throw AppError.badRequest(`HAS_SUBORDINATES_${subordinates}`);
    }

    // 2. Check linked user
    const linkedUser = await prisma.user.findFirst({
      where: { staffId: id }
    });

    if (linkedUser) {
      throw AppError.badRequest('HAS_LINKED_USER');
    }

    return prisma.staff.delete({ where: { id } });
  }

  /**
   * Find staff details for public verification by employee number,
   * including assigned assets and previous audit submissions.
   */
  static async findPublicStaffByEmployeeId(employeeNo: string) {
    const cleanEmpNo = employeeNo.trim();
    const unpaddedEmpNo = cleanEmpNo.replace(/^0+/, '');
    const searchEmpNos = Array.from(new Set([cleanEmpNo, unpaddedEmpNo].filter(Boolean)));

    const [staff, recentAudits] = await Promise.all([
      prisma.staff.findFirst({
        where: {
          employeeId: {
            in: searchEmpNos,
            mode: 'insensitive'
          }
        },
        select: {
          id: true,
          name: true,
          assignedITAssets: {
            select: {
              id: true,
              serialNumber: true,
              assetNumber: true,
              deviceType: true,
              brand: true,
              model: true,
              status: true
            }
          }
        }
      }),
      prisma.iTAssetAudit.findMany({
        where: {
          employeeNo: {
            in: searchEmpNos,
            mode: 'insensitive'
          },
          isRejected: false
        },
        orderBy: { createdAt: 'desc' },
        take: 10
      })
    ]);

    if (!staff && recentAudits.length === 0) {
      return { found: false };
    }

    const staffName = staff?.name || recentAudits[0]?.custodianName || "Staff Member";
    const staffId = staff?.id || "UNLINKED";

    // Merge assigned assets from master inventory with assets from previous audits
    const assetsMap = new Map<string, {
      id: string;
      serialNumber: string;
      assetNumber?: string | null;
      deviceType: "LAPTOP" | "MOBILE" | "DESKTOP" | "PRINTER" | "NETWORK" | "OTHER";
      brand?: string | null;
      model?: string | null;
      status: string;
    }>();

    // 1. Populate from active IT Assets
    if (staff?.assignedITAssets) {
      for (const asset of staff.assignedITAssets) {
        assetsMap.set(asset.deviceType, {
          id: asset.id,
          serialNumber: asset.serialNumber,
          assetNumber: asset.assetNumber,
          deviceType: asset.deviceType as any,
          brand: asset.brand,
          model: asset.model,
          status: asset.status
        });
      }
    }

    // 2. Fallback to previous audits if master inventory asset is missing for that deviceType
    for (const audit of recentAudits) {
      if (!audit.isPersonal && audit.serialNumber && !assetsMap.has(audit.deviceType)) {
        assetsMap.set(audit.deviceType, {
          id: audit.id,
          serialNumber: audit.serialNumber,
          assetNumber: audit.assetNumber,
          deviceType: audit.deviceType as any,
          brand: audit.brand,
          model: audit.model,
          status: audit.status || "ACTIVE"
        });
      }
    }

    const latestAuditWithLocation = recentAudits.find(a => a.department || a.siteOfficeId || a.location);

    return {
      found: true,
      staff: {
        id: staffId,
        name: staffName,
        department: latestAuditWithLocation?.department || null,
        siteOfficeId: latestAuditWithLocation?.siteOfficeId || null,
        location: latestAuditWithLocation?.location || null,
        assignedITAssets: Array.from(assetsMap.values())
      }
    };
  }
}
