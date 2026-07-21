import { AppError } from '@/lib/error';
import { SoftwareLicenseRepository } from '@/repositories/software-license.repository';
import { AuditService } from '@/services/audit.service';
import { prisma } from '@/lib/prisma';

export class SoftwareLicenseService {
  static async getLicenses(params: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
  }) {
    return SoftwareLicenseRepository.findAllLicenses(params);
  }

  static async getLicenseById(id: string) {
    return SoftwareLicenseRepository.findLicenseById(id);
  }

  static async createLicense(
    userId: string,
    data: {
      name: string;
      key?: string | null;
      vendor?: string | null;
      purchaseDate?: string | Date | null;
      expiryDate?: string | Date | null;
      purchaseCost?: number | null;
      totalLicenses?: number;
      status?: string;
      remarks?: string | null;
    },
    ipAddress?: string,
    userAgent?: string
  ) {
    const license = await SoftwareLicenseRepository.createLicense({
      name: data.name,
      key: data.key || null,
      vendor: data.vendor || null,
      purchaseDate: data.purchaseDate ? new Date(data.purchaseDate) : null,
      expiryDate: data.expiryDate ? new Date(data.expiryDate) : null,
      purchaseCost: data.purchaseCost || null,
      totalLicenses: data.totalLicenses ?? 1,
      status: data.status || 'ACTIVE',
      remarks: data.remarks || null
    });

    // Write audit trail
    await AuditService.log({
      userId,
      action: 'CREATE',
      entity: 'SoftwareLicense' as any,
      entityId: license.id,
      newValue: license,
      ipAddress,
      userAgent
    });

    return license;
  }

  static async updateLicense(
    userId: string,
    id: string,
    data: {
      name?: string;
      key?: string | null;
      vendor?: string | null;
      purchaseDate?: string | Date | null;
      expiryDate?: string | Date | null;
      purchaseCost?: number | null;
      totalLicenses?: number;
      status?: string;
      remarks?: string | null;
    },
    ipAddress?: string,
    userAgent?: string
  ) {
    const old = await SoftwareLicenseRepository.findLicenseById(id);
    if (!old) {
      throw AppError.badRequest('LICENSE_NOT_FOUND');
    }

    const updated = await SoftwareLicenseRepository.updateLicense(id, {
      name: data.name,
      key: data.key === null ? null : (data.key || undefined),
      vendor: data.vendor === null ? null : (data.vendor || undefined),
      purchaseDate: data.purchaseDate ? new Date(data.purchaseDate) : (data.purchaseDate === null ? null : undefined),
      expiryDate: data.expiryDate ? new Date(data.expiryDate) : (data.expiryDate === null ? null : undefined),
      purchaseCost: data.purchaseCost === null ? null : (data.purchaseCost || undefined),
      totalLicenses: data.totalLicenses,
      status: data.status,
      remarks: data.remarks === null ? null : (data.remarks || undefined)
    });

    // Write audit trail
    await AuditService.log({
      userId,
      action: 'UPDATE',
      entity: 'SoftwareLicense' as any,
      entityId: id,
      oldValue: old,
      newValue: updated,
      ipAddress,
      userAgent
    });

    return updated;
  }

  static async deleteLicense(userId: string, id: string, ipAddress?: string, userAgent?: string) {
    const old = await SoftwareLicenseRepository.findLicenseById(id);
    if (!old) {
      throw AppError.badRequest('LICENSE_NOT_FOUND');
    }

    const result = await SoftwareLicenseRepository.deleteLicense(id);

    // Write audit trail
    await AuditService.log({
      userId,
      action: 'DELETE',
      entity: 'SoftwareLicense' as any,
      entityId: id,
      oldValue: old,
      ipAddress,
      userAgent
    });

    return result;
  }

  static async assignLicense(
    userId: string,
    licenseId: string,
    data: {
      assignedUserId?: string | null;
      assignedAssetId?: string | null;
      assignedEmail?: string | null;
      remarks?: string | null;
    },
    ipAddress?: string,
    userAgent?: string
  ) {
    const license = await SoftwareLicenseRepository.findLicenseById(licenseId);
    if (!license) {
      throw AppError.badRequest('LICENSE_NOT_FOUND');
    }

    // Run transaction
    const assignment = await prisma.$transaction(async (tx) => {
      // Check if assignment target is provided
      if (!data.assignedUserId && !data.assignedAssetId) {
        throw AppError.badRequest('ASSIGNMENT_TARGET_REQUIRED');
      }

      return await SoftwareLicenseRepository.createAssignment({
        softwareLicenseId: licenseId,
        assignedUserId: data.assignedUserId || null,
        assignedAssetId: data.assignedAssetId || null,
        assignedEmail: data.assignedEmail || null,
        remarks: data.remarks || null
      }, tx);
    }, {
      timeout: 15000
    });

    // Write audit trail outside transaction
    await AuditService.log({
      userId,
      action: 'CREATE',
      entity: 'SoftwareLicenseAssignment' as any,
      entityId: assignment.id,
      newValue: assignment,
      ipAddress,
      userAgent
    });

    return assignment;
  }

  static async revokeLicense(userId: string, assignmentId: string, ipAddress?: string, userAgent?: string) {
    const old = await SoftwareLicenseRepository.findAssignmentById(assignmentId);
    if (!old) {
      throw AppError.badRequest('ASSIGNMENT_NOT_FOUND');
    }

    const result = await SoftwareLicenseRepository.deleteAssignment(assignmentId);

    // Write audit trail
    await AuditService.log({
      userId,
      action: 'DELETE',
      entity: 'SoftwareLicenseAssignment' as any,
      entityId: assignmentId,
      oldValue: old,
      ipAddress,
      userAgent
    });

    return result;
  }
}
