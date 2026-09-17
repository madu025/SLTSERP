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
    const digitsOnly = cleanEmpNo.replace(/\D/g, '');

    const searchEmpNos = Array.from(new Set([
      cleanEmpNo,
      unpaddedEmpNo,
      digitsOnly,
      digitsOnly ? digitsOnly.padStart(4, '0') : '',
      digitsOnly ? digitsOnly.padStart(5, '0') : '',
      digitsOnly ? `EPF${digitsOnly}` : '',
      digitsOnly ? `EPF${digitsOnly.padStart(4, '0')}` : '',
      digitsOnly ? `E${digitsOnly}` : ''
    ].filter(Boolean)));

    const [staff, user] = await Promise.all([
      prisma.staff.findFirst({
        where: {
          employeeId: {
            in: searchEmpNos,
            mode: 'insensitive' as const
          }
        },
        select: {
          id: true,
          name: true
        }
      }),
      prisma.user.findFirst({
        where: {
          OR: [
            { employeeId: { in: searchEmpNos, mode: 'insensitive' as const } },
            { username: { in: searchEmpNos, mode: 'insensitive' as const } }
          ]
        },
        select: {
          id: true,
          name: true,
          staffId: true
        }
      })
    ]);

    const targetStaffId = staff?.id || user?.staffId || null;
    const targetUserId = user?.id || null;

    const [recentAudits, directAssets] = await Promise.all([
      prisma.iTAssetAudit.findMany({
        where: {
          employeeNo: {
            in: searchEmpNos,
            mode: 'insensitive' as const
          },
          isRejected: false
        },
        orderBy: { createdAt: 'desc' },
        take: 10
      }),
      prisma.iTAsset.findMany({
        where: {
          OR: [
            { lastSeenEmployeeNumber: { in: searchEmpNos, mode: 'insensitive' as const } },
            { employeeUsername: { in: searchEmpNos, mode: 'insensitive' as const } },
            ...(targetStaffId ? [{ assignedStaffId: targetStaffId }] : []),
            ...(targetUserId ? [{ assignedUserId: targetUserId }] : [])
          ]
        },
        select: {
          id: true,
          serialNumber: true,
          assetNumber: true,
          deviceType: true,
          brand: true,
          model: true,
          status: true,
          lastAuditedAt: true,
          nextAuditDueAt: true,
          assignedStaffId: true,
          assignedUserId: true
        }
      })
    ]);

    if (!staff && !user && recentAudits.length === 0 && directAssets.length === 0) {
      return { found: false };
    }

    const staffName = staff?.name || user?.name || recentAudits[0]?.custodianName || "Staff Member";
    const staffId = targetStaffId || "UNLINKED";

    // Auto-heal unlinked ITAssets if staff is found
    if (targetStaffId) {
      const unlinked = directAssets.filter(a => !a.assignedStaffId);
      if (unlinked.length > 0) {
        Promise.all(
          unlinked.map(a =>
            prisma.iTAsset.update({
              where: { id: a.id },
              data: { assignedStaffId: targetStaffId }
            }).catch(err => console.error("Auto-heal asset link failed:", err))
          )
        ).catch(() => {});
      }
    }

    // Merge assigned assets from master inventory with assets from agent sync & previous audits
    interface FormattedAsset {
      id: string;
      serialNumber: string;
      assetNumber?: string | null;
      deviceType: "LAPTOP" | "MOBILE" | "DESKTOP" | "PRINTER" | "NETWORK" | "OTHER";
      brand?: string | null;
      model?: string | null;
      status: string;
      lastAuditedAt?: string | null;
      nextAuditDueAt?: string | null;
      isConfirmed?: boolean;
    }

    const assetsMap = new Map<string, FormattedAsset>();

    // 1. Populate from direct IT Assets (including agent-synced assets)
    for (const asset of directAssets) {
      assetsMap.set(asset.deviceType, {
        id: asset.id,
        serialNumber: asset.serialNumber,
        assetNumber: asset.assetNumber,
        deviceType: asset.deviceType as any,
        brand: asset.brand,
        model: asset.model,
        status: asset.status,
        lastAuditedAt: asset.lastAuditedAt ? asset.lastAuditedAt.toISOString() : null,
        nextAuditDueAt: asset.nextAuditDueAt ? asset.nextAuditDueAt.toISOString() : null,
        isConfirmed: !!asset.lastAuditedAt
      });
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
          status: audit.status || "ACTIVE",
          lastAuditedAt: audit.lastAuditedAt ? audit.lastAuditedAt.toISOString() : audit.createdAt.toISOString(),
          nextAuditDueAt: audit.nextAuditDueAt ? audit.nextAuditDueAt.toISOString() : null,
          isConfirmed: audit.isConfirmed
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
