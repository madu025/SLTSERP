/* eslint-disable @typescript-eslint/no-explicit-any */
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

export class SoftwareLicenseRepository {
  static async findLicenseById(id: string, tx?: any) {
    const db = tx || prisma;
    return db.softwareLicense.findUnique({
      where: { id },
      include: {
        assignments: {
          include: {
            assignedStaff: {
              select: { id: true, name: true, employeeId: true, designation: true }
            },
            assignedAsset: {
              select: { id: true, assetNumber: true, brand: true, model: true }
            }
          }
        }
      }
    });
  }

  static async findLicenseByName(name: string, tx?: any) {
    const db = tx || prisma;
    return db.softwareLicense.findFirst({
      where: { name }
    });
  }

  static async findAllLicenses(
    { page = 1, limit = 20, search = '', status }: {
      page?: number;
      limit?: number;
      search?: string;
      status?: string;
    },
    tx?: any
  ) {
    const db = tx || prisma;
    const skip = (page - 1) * limit;
    const where: Prisma.SoftwareLicenseWhereInput = {};

    if (status) {
      where.status = status;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { key: { contains: search, mode: 'insensitive' } },
        { vendor: { contains: search, mode: 'insensitive' } },
        { remarks: { contains: search, mode: 'insensitive' } },
        {
          assignments: {
            some: {
              OR: [
                { assignedEmail: { contains: search, mode: 'insensitive' } },
                {
                  assignedStaff: {
                    OR: [
                      { name: { contains: search, mode: 'insensitive' } },
                      { employeeId: { contains: search, mode: 'insensitive' } }
                    ]
                  }
                }
              ]
            }
          }
        }
      ];
    }

    const [total, licenses] = await Promise.all([
      db.softwareLicense.count({ where }),
      db.softwareLicense.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: { assignments: true }
          }
        }
      })
    ]);

    return { total, licenses };
  }

  static async createLicense(data: Prisma.SoftwareLicenseUncheckedCreateInput, tx?: any) {
    const db = tx || prisma;
    return db.softwareLicense.create({
      data
    });
  }

  static async updateLicense(id: string, data: Prisma.SoftwareLicenseUncheckedUpdateInput, tx?: any) {
    const db = tx || prisma;
    return db.softwareLicense.update({
      where: { id },
      data
    });
  }

  static async deleteLicense(id: string, tx?: any) {
    const db = tx || prisma;
    return db.softwareLicense.delete({
      where: { id }
    });
  }

  static async createAssignment(data: Prisma.SoftwareLicenseAssignmentUncheckedCreateInput, tx?: any) {
    const db = tx || prisma;
    return db.softwareLicenseAssignment.create({
      data,
      include: {
        assignedStaff: {
          select: { id: true, name: true, employeeId: true }
        },
        assignedAsset: {
          select: { id: true, assetNumber: true, brand: true, model: true }
        }
      }
    });
  }

  static async deleteAssignment(id: string, tx?: any) {
    const db = tx || prisma;
    return db.softwareLicenseAssignment.delete({
      where: { id }
    });
  }

  static async findAssignmentById(id: string, tx?: any) {
    const db = tx || prisma;
    return db.softwareLicenseAssignment.findUnique({
      where: { id }
    });
  }

  static async countAssignmentsForLicense(licenseId: string, tx?: any) {
    const db = tx || prisma;
    return db.softwareLicenseAssignment.count({
      where: { softwareLicenseId: licenseId }
    });
  }
}
