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
      throw new Error('CANNOT_REPORT_TO_SELF');
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
      throw new Error(`HAS_SUBORDINATES_${subordinates}`);
    }

    // 2. Check linked user
    const linkedUser = await prisma.user.findFirst({
      where: { staffId: id }
    });

    if (linkedUser) {
      throw new Error('HAS_LINKED_USER');
    }

    return prisma.staff.delete({ where: { id } });
  }
}
